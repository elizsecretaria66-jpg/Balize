"""
Importação de extratos bancários em PDF.

PDF não tem "fitid" (isso só existe no OFX), então geramos um ID sintético e
estável a partir de data + descrição + valor (+ nº da ocorrência, para
lançamentos idênticos no mesmo dia). Reenviar o mesmo PDF não duplica nada.
"""

from collections import Counter

from sqlalchemy.orm import Session

from app.models import StatusConciliacao, TipoTransacao, TransacaoBancaria
from app.services.leitura import movimentos_do_pdf
from app.services.parsers import gerar_fitid


def processar_pdf_extrato(conteudo_arquivo: bytes, empresa_id: str, db: Session) -> dict:
    resultado = {"processados": 0, "duplicados_ignorados": 0, "erros": []}

    try:
        movimentos = movimentos_do_pdf(conteudo_arquivo)
    except Exception as e:
        resultado["erros"].append(f"Falha ao abrir/ler o PDF: {e}")
        return resultado

    if not movimentos:
        resultado["erros"].append(
            "Não encontrei movimentações com data e valor neste PDF. "
            "Se for um extrato escaneado (imagem), envie o arquivo OFX do banco."
        )
        return resultado

    ocorrencias: Counter = Counter()
    candidatos: list[tuple[str, dict]] = []
    for mov in movimentos:
        chave = (mov["data"], " ".join(mov["descricao"].upper().split()), round(mov["valor"], 2))
        ocorrencias[chave] += 1
        fitid = gerar_fitid(empresa_id, mov["data"], mov["descricao"], mov["valor"], ocorrencias[chave])
        candidatos.append((fitid, mov))

    existentes = {
        r[0]
        for r in db.query(TransacaoBancaria.fitid_ofx)
        .filter(
            TransacaoBancaria.empresa_id == empresa_id,
            TransacaoBancaria.fitid_ofx.in_([f for f, _ in candidatos]),
        )
        .all()
    }

    novas = []
    for fitid, mov in candidatos:
        if fitid in existentes:
            resultado["duplicados_ignorados"] += 1
            continue
        novas.append(
            TransacaoBancaria(
                empresa_id=empresa_id,
                fitid_ofx=fitid,
                data=mov["data"],
                descricao_extrato=mov["descricao"][:500],
                valor=abs(mov["valor"]),
                tipo=TipoTransacao.ENTRADA if mov["valor"] > 0 else TipoTransacao.SAIDA,
                status_conciliacao=StatusConciliacao.PENDENTE,
            )
        )

    try:
        if novas:
            db.add_all(novas)
            db.commit()
        resultado["processados"] = len(novas)
    except Exception as e:
        db.rollback()
        resultado["erros"].append(f"Falha ao salvar transações: {e}")

    return resultado
