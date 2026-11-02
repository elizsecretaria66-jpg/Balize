"""
Leitura de comprovantes/faturas (PDF, PNG, JPG) e gravação em Documentos.

Um PDF pode conter vários comprovantes: cada um vira um Documento próprio.
Comprovantes idênticos (mesmo valor, data, CNPJ/CPF e descrição) já enviados
antes são ignorados.
"""

import os
import re
import unicodedata
import uuid

from sqlalchemy.orm import Session

from app.models import Documento, StatusProcessamento, TipoDocumento
from app.services.leitura import blocos_de_comprovantes
from app.services.parsers import (
    extrair_cnpj_cpf,
    extrair_data,
    extrair_descricao,
    extrair_valor,
    inferir_tipo,
)

DIRETORIO_UPLOADS = os.getenv("DIRETORIO_UPLOADS_COMPROVANTES", "/var/data/comprovantes")
EXTENSOES = (".pdf", ".png", ".jpg", ".jpeg")


def _salvar_arquivo_local(conteudo: bytes, nome_original: str) -> str:
    """Grava o arquivo mantendo o nome original legível: <id>__<nome>.ext"""
    os.makedirs(DIRETORIO_UPLOADS, exist_ok=True)
    nome, ext = os.path.splitext(os.path.basename(nome_original))
    nome = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode()
    nome = re.sub(r"[^A-Za-z0-9._-]+", "_", nome).strip("_")[:60] or "arquivo"
    caminho = os.path.join(DIRETORIO_UPLOADS, f"{uuid.uuid4().hex[:12]}__{nome}{ext.lower() or '.bin'}")
    with open(caminho, "wb") as f:
        f.write(conteudo)
    return caminho


def processar_comprovante(conteudo: bytes, nome_arquivo: str, empresa_id: str, db: Session) -> dict:
    extensao = os.path.splitext(nome_arquivo)[1].lower()
    if extensao not in EXTENSOES:
        raise ValueError("Formato não suportado. Envie PDF, PNG ou JPG.")

    try:
        blocos = blocos_de_comprovantes(conteudo, extensao)
    except Exception as e:
        raise RuntimeError(f"Não foi possível ler o arquivo: {e}") from e

    lidos = []
    for bloco in blocos:
        lidos.append(
            {
                "valor": extrair_valor(bloco),
                "data": extrair_data(bloco),
                "cnpj": extrair_cnpj_cpf(bloco),
                "descricao": extrair_descricao(bloco),
                "tipo": inferir_tipo(bloco),
            }
        )

    # Descarta trechos sem valor nem data (rodapés, cabeçalhos). Se nada sobrar,
    # registra UM documento com erro para o usuário ver que a leitura falhou.
    validos = [c for c in lidos if c["valor"] is not None or c["data"] is not None]
    if not validos:
        validos = [{"valor": None, "data": None, "cnpj": None, "descricao": None, "tipo": "RECIBO"}]

    caminho = _salvar_arquivo_local(conteudo, nome_arquivo)
    resultado = {"lidos": 0, "duplicados_ignorados": 0, "erros": [], "documentos": []}

    for c in validos:
        if c["valor"] is not None and c["data"] is not None:
            repetido = (
                db.query(Documento.id)
                .filter(
                    Documento.empresa_id == empresa_id,
                    Documento.valor_total == c["valor"],
                    Documento.data_emissao == c["data"],
                    Documento.cnpj_emissor == c["cnpj"],
                    Documento.descricao == c["descricao"],
                )
                .first()
            )
            if repetido:
                resultado["duplicados_ignorados"] += 1
                continue

        doc = Documento(
            empresa_id=empresa_id,
            url_arquivo_local=caminho,
            data_emissao=c["data"],
            valor_total=c["valor"],
            cnpj_emissor=c["cnpj"],
            descricao=c["descricao"],
            status_processamento=(
                StatusProcessamento.PROCESSADO if c["valor"] is not None else StatusProcessamento.ERRO
            ),
            tipo_doc=TipoDocumento(c["tipo"]),
        )
        db.add(doc)
        resultado["documentos"].append(doc)

    db.commit()
    for d in resultado["documentos"]:
        db.refresh(d)
    resultado["lidos"] = len(resultado["documentos"])

    if resultado["lidos"] == 0:  # tudo duplicado: não deixa o arquivo órfão no disco
        try:
            os.remove(caminho)
        except OSError:
            pass
    elif all(d.status_processamento == StatusProcessamento.ERRO for d in resultado["documentos"]):
        resultado["erros"].append(
            "Não consegui ler o valor deste comprovante. Confira se a imagem está nítida e inteira."
        )
    return resultado
