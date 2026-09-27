"""
Serviço de importação de extratos bancários em formato .OFX.

Requer: pip install ofxparse
"""

from datetime import datetime
from io import StringIO

from ofxparse import OfxParser
from sqlalchemy.orm import Session

from app.models import StatusConciliacao, TipoTransacao, TransacaoBancaria


def _decodificar(conteudo: bytes | str) -> str:
    if isinstance(conteudo, str):
        return conteudo
    try:
        return conteudo.decode("utf-8")
    except UnicodeDecodeError:
        return conteudo.decode("latin-1")


def processar_ofx(conteudo_arquivo: bytes | str, empresa_id: str, db: Session) -> dict:
    """
    Faz o parse de um arquivo .OFX e insere as transações na tabela
    TransacoesBancarias, ignorando duplicatas (mesmo fitid_ofx + empresa_id).

    Returns:
        {"processados": int, "duplicados_ignorados": int, "erros": [str]}
    """
    resultado = {"processados": 0, "duplicados_ignorados": 0, "erros": []}

    try:
        texto = _decodificar(conteudo_arquivo)
        ofx = OfxParser.parse(StringIO(texto))
        transacoes_ofx = ofx.account.statement.transactions
    except Exception as e:
        resultado["erros"].append(f"Arquivo OFX inválido ou corrompido: {e}")
        return resultado

    fitids_do_arquivo = [t.id for t in transacoes_ofx if getattr(t, "id", None)]

    fitids_existentes: set[str] = set()
    if fitids_do_arquivo:
        rows = (
            db.query(TransacaoBancaria.fitid_ofx)
            .filter(
                TransacaoBancaria.empresa_id == empresa_id,
                TransacaoBancaria.fitid_ofx.in_(fitids_do_arquivo),
            )
            .all()
        )
        fitids_existentes = {r[0] for r in rows}

    novas: list[TransacaoBancaria] = []

    for t in transacoes_ofx:
        fitid = getattr(t, "id", None)
        if not fitid:
            resultado["erros"].append("Transação sem fitid — ignorada.")
            continue

        if fitid in fitids_existentes:
            resultado["duplicados_ignorados"] += 1
            continue

        data_lancamento = t.date.date() if isinstance(t.date, datetime) else t.date
        valor = float(t.amount)
        descricao = (getattr(t, "memo", None) or getattr(t, "payee", None) or "").strip()

        novas.append(
            TransacaoBancaria(
                empresa_id=empresa_id,
                fitid_ofx=fitid,
                data=data_lancamento,
                descricao_extrato=descricao,
                valor=abs(valor),
                tipo=TipoTransacao.ENTRADA if valor >= 0 else TipoTransacao.SAIDA,
                status_conciliacao=StatusConciliacao.PENDENTE,
            )
        )
        fitids_existentes.add(fitid)  # cobre fitid duplicado dentro do próprio arquivo

    try:
        if novas:
            db.add_all(novas)
            db.commit()
        resultado["processados"] = len(novas)
    except Exception as e:
        db.rollback()
        resultado["erros"].append(f"Falha ao salvar transações: {e}")

    return resultado
