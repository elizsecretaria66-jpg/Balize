"""
Serviço de OCR para comprovantes/faturas (PDF, PNG, JPG).

Requer:
    pip install pytesseract opencv-python-headless pdfplumber pillow
    Tesseract OCR precisa estar instalado no sistema operacional
    (ex: `apt-get install tesseract-ocr tesseract-ocr-por`).
"""

import os
import re
import uuid
from datetime import datetime
from io import BytesIO

import cv2
import numpy as np
import pdfplumber
import pytesseract
from PIL import Image
from sqlalchemy.orm import Session

from app.models import Documento, StatusProcessamento, TipoDocumento

DIRETORIO_UPLOADS = os.getenv("DIRETORIO_UPLOADS_COMPROVANTES", "/var/data/comprovantes")

PADRAO_CNPJ = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")
PADRAO_CPF = re.compile(r"\d{3}\.\d{3}\.\d{3}-\d{2}")
PADRAO_DATA = re.compile(r"\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b")

# Linha candidata a "valor total": contém uma das palavras-chave E um valor monetário
PADRAO_VALOR_MONETARIO = re.compile(r"R?\$?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2})")
PALAVRAS_CHAVE_TOTAL = ("TOTAL", "VALOR TOTAL", "VALOR A PAGAR", "VALOR")


def _salvar_arquivo_local(conteudo: bytes, nome_original: str) -> str:
    os.makedirs(DIRETORIO_UPLOADS, exist_ok=True)
    extensao = os.path.splitext(nome_original)[1].lower() or ".bin"
    nome_arquivo = f"{uuid.uuid4()}{extensao}"
    caminho = os.path.join(DIRETORIO_UPLOADS, nome_arquivo)
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return caminho


def _preprocessar_imagem(conteudo: bytes) -> np.ndarray:
    """Escala de cinza + limiarização (Otsu) para melhorar o contraste antes do OCR."""
    array = np.frombuffer(conteudo, dtype=np.uint8)
    imagem = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if imagem is None:
        raise ValueError("Não foi possível decodificar a imagem enviada.")

    cinza = cv2.cvtColor(imagem, cv2.COLOR_BGR2GRAY)
    cinza = cv2.medianBlur(cinza, 3)
    _, limiarizada = cv2.threshold(cinza, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return limiarizada


def _ocr_imagem(conteudo: bytes) -> str:
    imagem_tratada = _preprocessar_imagem(conteudo)
    return pytesseract.image_to_string(imagem_tratada, lang="por")


def _extrair_texto_pdf(conteudo: bytes) -> str:
    """
    Tenta extrair texto nativo do PDF primeiro (mais rápido e confiável).
    Se o PDF for escaneado (sem camada de texto), faz OCR página a página.
    """
    texto_total = ""
    with pdfplumber.open(BytesIO(conteudo)) as pdf:
        for page in pdf.pages:
            texto_pagina = page.extract_text() or ""
            if len(texto_pagina.strip()) >= 20:
                texto_total += texto_pagina + "\n"
                continue

            # Sem camada de texto suficiente -> rasteriza a página e roda OCR
            imagem_pagina = page.to_image(resolution=300).original
            buffer = BytesIO()
            imagem_pagina.save(buffer, format="PNG")
            texto_total += _ocr_imagem(buffer.getvalue()) + "\n"

    return texto_total


def _extrair_valor_total(texto: str) -> float | None:
    melhor_valor = None
    for linha in texto.upper().split("\n"):
        if any(palavra in linha for palavra in PALAVRAS_CHAVE_TOTAL):
            match = PADRAO_VALOR_MONETARIO.search(linha)
            if match:
                valor_str = match.group(1).replace(".", "").replace(",", ".")
                try:
                    melhor_valor = float(valor_str)
                except ValueError:
                    continue
    if melhor_valor is not None:
        return melhor_valor

    # Fallback: pega o maior valor monetário encontrado no texto inteiro
    valores = PADRAO_VALOR_MONETARIO.findall(texto)
    valores_float = []
    for v in valores:
        try:
            valores_float.append(float(v.replace(".", "").replace(",", ".")))
        except ValueError:
            continue
    return max(valores_float) if valores_float else None


def _extrair_data_emissao(texto: str) -> str | None:
    match = PADRAO_DATA.search(texto)
    if not match:
        return None
    bruta = match.group(1)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(bruta, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def _extrair_cnpj_cpf(texto: str) -> str | None:
    match_cnpj = PADRAO_CNPJ.search(texto)
    if match_cnpj:
        return match_cnpj.group()
    match_cpf = PADRAO_CPF.search(texto)
    if match_cpf:
        return match_cpf.group()
    return None


def processar_comprovante(
    conteudo: bytes, nome_arquivo: str, empresa_id: str, db: Session
) -> dict:
    """
    Processa um comprovante/fatura (PDF, PNG ou JPG), extrai os campos via
    OCR + regex, salva o registro em Documentos e retorna os dados extraídos
    para o usuário confirmar no frontend.
    """
    extensao = os.path.splitext(nome_arquivo)[1].lower()
    if extensao not in (".pdf", ".png", ".jpg", ".jpeg"):
        raise ValueError("Formato não suportado. Envie PDF, PNG ou JPG.")

    caminho_local = _salvar_arquivo_local(conteudo, nome_arquivo)

    try:
        if extensao == ".pdf":
            texto = _extrair_texto_pdf(conteudo)
        else:
            texto = _ocr_imagem(conteudo)

        valor_total = _extrair_valor_total(texto)
        data_emissao = _extrair_data_emissao(texto)
        cnpj_cpf = _extrair_cnpj_cpf(texto)

        campos_encontrados = sum(x is not None for x in (valor_total, data_emissao, cnpj_cpf))
        confianca = "ALTA" if campos_encontrados == 3 else ("PARCIAL" if campos_encontrados >= 1 else "BAIXA")

        documento = Documento(
            empresa_id=empresa_id,
            url_arquivo_local=caminho_local,
            data_emissao=datetime.fromisoformat(data_emissao).date() if data_emissao else None,
            valor_total=valor_total,
            cnpj_emissor=cnpj_cpf,
            status_processamento=StatusProcessamento.PROCESSADO,
            tipo_doc=TipoDocumento.RECIBO,  # tipo default; usuário pode reclassificar no frontend
        )
        db.add(documento)
        db.commit()
        db.refresh(documento)

        return {
            "documento_id": documento.id,
            "valor_total": valor_total,
            "data_emissao": data_emissao,
            "cnpj_cpf": cnpj_cpf,
            "texto_bruto": texto.strip(),
            "confianca_extracao": confianca,
        }

    except Exception as e:
        documento = Documento(
            empresa_id=empresa_id,
            url_arquivo_local=caminho_local,
            status_processamento=StatusProcessamento.ERRO,
            tipo_doc=TipoDocumento.RECIBO,
        )
        db.add(documento)
        db.commit()
        raise RuntimeError(f"Falha ao processar comprovante: {e}") from e
