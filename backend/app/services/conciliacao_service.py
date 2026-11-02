"""
Motor de Conciliação Bancária Automática.

Regras:
1. MATCH PERFEITO: mesmo valor + diferença de datas <= 3 dias
   -> status_conciliacao = CONCILIADO, vincula documento_id_fk.
2. SUGESTÃO: mesmo valor + diferença de datas entre 4 e 7 dias
   -> status_conciliacao = SUGESTAO, vincula documento_id_fk (para revisão do
      usuário, que aprova ou rejeita na tela).
3. Sem correspondência: tenta categorizar automaticamente via RegrasCategorizacao,
   procurando a palavra-chave (case-insensitive) dentro da descricao_extrato.
   Quando várias regras combinam, a palavra-chave mais longa (mais específica)
   vence.

Tolerância de arredondamento monetário: 1 centavo (evita falsos negativos
por imprecisão de ponto flutuante).
"""

from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import (
    Documento,
    RegraCategorizacao,
    StatusConciliacao,
    StatusProcessamento,
    TransacaoBancaria,
)

TOLERANCIA_VALOR = 0.01
DIAS_MATCH_PERFEITO = 3
DIAS_MATCH_SUGESTAO = 7


def _documentos_disponiveis(db: Session, empresa_id: str) -> list[Documento]:
    """Documentos processados e ainda não vinculados a nenhuma transação."""
    ja_vinculados = (
        db.query(TransacaoBancaria.documento_id_fk)
        .filter(
            TransacaoBancaria.empresa_id == empresa_id,
            TransacaoBancaria.documento_id_fk.isnot(None),
        )
        .subquery()
    )

    return (
        db.query(Documento)
        .filter(
            Documento.empresa_id == empresa_id,
            Documento.status_processamento == StatusProcessamento.PROCESSADO,
            Documento.valor_total.isnot(None),
            Documento.data_emissao.isnot(None),
            ~Documento.id.in_(ja_vinculados),
        )
        .all()
    )


def _melhor_candidato(
    transacao: TransacaoBancaria, documentos: list[Documento]
) -> tuple[Documento, int] | None:
    """Retorna (documento, diferenca_dias) do melhor candidato dentro da janela de 7 dias."""
    melhor = None
    menor_diff = None

    for doc in documentos:
        if abs(float(doc.valor_total) - float(transacao.valor)) > TOLERANCIA_VALOR:
            continue

        diff_dias = abs((transacao.data - doc.data_emissao).days)
        if diff_dias > DIAS_MATCH_SUGESTAO:
            continue

        if menor_diff is None or diff_dias < menor_diff:
            menor_diff = diff_dias
            melhor = doc

    if melhor is None:
        return None
    return melhor, menor_diff


def _aplicar_regra_categorizacao(
    transacao: TransacaoBancaria, regras: list[RegraCategorizacao]
) -> RegraCategorizacao | None:
    descricao_upper = transacao.descricao_extrato.upper()
    candidatas = [r for r in regras if r.palavra_chave.upper() in descricao_upper]
    if not candidatas:
        return None
    # regra mais específica (palavra-chave mais longa) primeiro
    return max(candidatas, key=lambda r: len(r.palavra_chave))


def processar_conciliacao(empresa_id: str, db: Session) -> dict:
    resumo = {
        "conciliados": 0,
        "sugestoes": 0,
        "categorizados_automaticamente": 0,
        "sem_match": 0,
        "detalhes": {
            "conciliados": [],
            "sugestoes": [],
            "categorizados_automaticamente": [],
            "sem_match": [],
        },
    }

    transacoes_pendentes = (
        db.query(TransacaoBancaria)
        .filter(
            TransacaoBancaria.empresa_id == empresa_id,
            TransacaoBancaria.status_conciliacao == StatusConciliacao.PENDENTE,
        )
        .all()
    )

    documentos_disponiveis = _documentos_disponiveis(db, empresa_id)
    regras = db.query(RegraCategorizacao).filter_by(empresa_id=empresa_id).all()

    for transacao in transacoes_pendentes:
        candidato = _melhor_candidato(transacao, documentos_disponiveis)

        if candidato is not None:
            documento, diff_dias = candidato

            if diff_dias <= DIAS_MATCH_PERFEITO:
                transacao.status_conciliacao = StatusConciliacao.CONCILIADO
                transacao.documento_id_fk = documento.id
                documentos_disponiveis.remove(documento)  # não pode ser reutilizado
                resumo["conciliados"] += 1
                resumo["detalhes"]["conciliados"].append(transacao.id)
                continue

            # 4 a 7 dias
            transacao.status_conciliacao = StatusConciliacao.SUGESTAO
            transacao.documento_id_fk = documento.id
            documentos_disponiveis.remove(documento)
            resumo["sugestoes"] += 1
            resumo["detalhes"]["sugestoes"].append(transacao.id)
            continue

        # Sem documento correspondente -> tenta categorização automática
        regra = _aplicar_regra_categorizacao(transacao, regras)
        if regra is not None:
            transacao.categoria_id = regra.categoria_id_fk
            resumo["categorizados_automaticamente"] += 1
            resumo["detalhes"]["categorizados_automaticamente"].append(transacao.id)
        else:
            resumo["sem_match"] += 1
            resumo["detalhes"]["sem_match"].append(transacao.id)

    db.commit()
    return resumo
