"""
Leitura de arquivos: PDF/imagem -> texto e movimentos. Não acessa o banco.

Requer: pdfplumber, pytesseract, opencv-python-headless, numpy
(e o Tesseract instalado no sistema para ler imagens/PDFs escaneados).
"""

import re
from io import BytesIO

import cv2
import numpy as np
import pdfplumber
import pytesseract

from app.services.parsers import dividir_em_comprovantes, parse_extrato_tabela, parse_extrato_texto


# ------------------------------------------------------------------------ OCR
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


def ocr_imagem(conteudo: bytes) -> str:
    imagem = _preprocessar_imagem(conteudo)
    try:
        return pytesseract.image_to_string(imagem, lang="por")
    except pytesseract.TesseractError:
        return pytesseract.image_to_string(imagem)  # idioma português indisponível


# ----------------------------------------------------------------- comprovantes
def _textos_da_pagina(page) -> list[str]:
    """
    Devolve o texto da página, um item por coluna de comprovantes.
    Recibos lado a lado têm o rótulo "Data:" em mais de uma posição horizontal;
    nesse caso cortamos a página em colunas para o texto não se misturar.
    """
    palavras = page.extract_words()
    xs = sorted(w["x0"] for w in palavras if re.fullmatch(r"(?i)data:", w["text"]))
    colunas: list[float] = []
    for x in xs:
        if not colunas or x - colunas[-1] > 20:
            colunas.append(x)

    if len(colunas) >= 2:
        limites = [0.0] + [c - 8 for c in colunas[1:]] + [float(page.width)]
        return [
            page.crop((esq, 0, dir_, float(page.height))).extract_text() or ""
            for esq, dir_ in zip(limites, limites[1:])
        ]

    texto = page.extract_text() or ""
    if len(texto.strip()) < 20:  # página escaneada, sem camada de texto
        buffer = BytesIO()
        page.to_image(resolution=300).original.save(buffer, format="PNG")
        texto = ocr_imagem(buffer.getvalue())
    return [texto]


def blocos_de_comprovantes(conteudo: bytes, extensao: str) -> list[str]:
    """Um texto por comprovante encontrado no arquivo."""
    if extensao != ".pdf":
        return [ocr_imagem(conteudo)]

    blocos: list[str] = []
    with pdfplumber.open(BytesIO(conteudo)) as pdf:
        for page in pdf.pages:
            for texto_coluna in _textos_da_pagina(page):
                blocos.extend(dividir_em_comprovantes(texto_coluna))
    return blocos


# ---------------------------------------------------------------------- extrato
def movimentos_do_pdf(conteudo: bytes) -> list[dict]:
    """Lê as movimentações de um extrato em PDF (tabela; se não houver, texto linha a linha)."""
    movimentos: list[dict] = []
    with pdfplumber.open(BytesIO(conteudo)) as pdf:
        for page in pdf.pages:
            achados: list[dict] = []
            for tabela in page.extract_tables():
                achados.extend(parse_extrato_tabela(tabela))
            if not achados:
                achados = parse_extrato_texto(page.extract_text() or "")
            movimentos.extend(achados)
    return movimentos
