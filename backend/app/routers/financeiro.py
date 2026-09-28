"""Transações (listagem/ações), Documentos (listagem), Lançamentos (a pagar/receber) e Dashboard."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Documento,
    LancamentoFinanceiro,
    StatusConciliacao,
    StatusLancamento,
    StatusProcessamento,
    TipoDocumento,
    TipoLancamento,
    TipoTransacao,
    TransacaoBancaria,
)
from app.schemas import DocumentoOut, TransacaoBancariaOut

router = APIRouter(prefix="/api/v1", tags=["financeiro"])


# ---------- Transações ----------
@router.get("/transacoes", response_model=list[TransacaoBancariaOut])
def listar_transacoes(
    empresa_id: str,
    status: StatusConciliacao | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(TransacaoBancaria).filter_by(empresa_id=empresa_id)
    if status:
        q = q.filter(TransacaoBancaria.status_conciliacao == status)
    return q.order_by(TransacaoBancaria.data.desc()).limit(500).all()


@router.post("/transacoes/{transacao_id}/aprovar", response_model=TransacaoBancariaOut)
def aprovar_conciliacao(transacao_id: str, db: Session = Depends(get_db)):
    t = db.get(TransacaoBancaria, transacao_id)
    if not t:
        raise HTTPException(404, "Transação não encontrada.")
    t.status_conciliacao = StatusConciliacao.CONCILIADO
    db.commit()
    return t


class CategorizarIn(BaseModel):
    categoria_id: str


@router.post("/transacoes/{transacao_id}/categorizar", response_model=TransacaoBancariaOut)
def categorizar_transacao(transacao_id: str, dados: CategorizarIn, db: Session = Depends(get_db)):
    t = db.get(TransacaoBancaria, transacao_id)
    if not t:
        raise HTTPException(404, "Transação não encontrada.")
    t.categoria_id = dados.categoria_id
    db.commit()
    return t


# ---------- Documentos ----------
@router.get("/documentos", response_model=list[DocumentoOut])
def listar_documentos(
    empresa_id: str,
    tipo_doc: TipoDocumento | None = None,
    status: StatusProcessamento | None = None,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Documento).filter_by(empresa_id=empresa_id)
    if tipo_doc:
        q = q.filter(Documento.tipo_doc == tipo_doc)
    if status:
        q = q.filter(Documento.status_processamento == status)
    if data_inicio:
        q = q.filter(Documento.data_emissao >= data_inicio)
    if data_fim:
        q = q.filter(Documento.data_emissao <= data_fim)
    return q.order_by(Documento.criado_em.desc()).limit(500).all()


class TipoDocIn(BaseModel):
    tipo_doc: TipoDocumento


@router.patch("/documentos/{documento_id}", response_model=DocumentoOut)
def reclassificar_documento(documento_id: str, dados: TipoDocIn, db: Session = Depends(get_db)):
    doc = db.get(Documento, documento_id)
    if not doc:
        raise HTTPException(404, "Documento não encontrado.")
    doc.tipo_doc = dados.tipo_doc
    db.commit()
    return doc


# ---------- Lançamentos (contas a pagar / receber) ----------
class LancamentoIn(BaseModel):
    tipo: TipoLancamento
    descricao: str
    valor: float
    data_vencimento: date
    categoria_id: str | None = None


class LancamentoOut(LancamentoIn):
    id: str
    status: StatusLancamento
    data_pagamento: date | None

    model_config = {"from_attributes": True}


@router.get("/lancamentos", response_model=list[LancamentoOut])
def listar_lancamentos(
    empresa_id: str,
    tipo: TipoLancamento | None = None,
    status: StatusLancamento | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(LancamentoFinanceiro).filter_by(empresa_id=empresa_id)
    if tipo:
        q = q.filter(LancamentoFinanceiro.tipo == tipo)
    if status:
        q = q.filter(LancamentoFinanceiro.status == status)
    return q.order_by(LancamentoFinanceiro.data_vencimento).limit(500).all()


@router.post("/lancamentos", response_model=LancamentoOut)
def criar_lancamento(empresa_id: str, dados: LancamentoIn, db: Session = Depends(get_db)):
    if dados.valor <= 0:
        raise HTTPException(400, "O valor deve ser maior que zero.")
    lanc = LancamentoFinanceiro(empresa_id=empresa_id, **dados.model_dump())
    db.add(lanc)
    db.commit()
    db.refresh(lanc)
    return lanc


@router.post("/lancamentos/{lancamento_id}/baixar", response_model=LancamentoOut)
def baixar_lancamento(lancamento_id: str, db: Session = Depends(get_db)):
    lanc = db.get(LancamentoFinanceiro, lancamento_id)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado.")
    lanc.status = StatusLancamento.PAGO
    lanc.data_pagamento = date.today()
    db.commit()
    return lanc


@router.delete("/lancamentos/{lancamento_id}", status_code=204)
def excluir_lancamento(lancamento_id: str, db: Session = Depends(get_db)):
    lanc = db.get(LancamentoFinanceiro, lancamento_id)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado.")
    db.delete(lanc)
    db.commit()


# ---------- Dashboard ----------
@router.get("/dashboard")
def dashboard(empresa_id: str, db: Session = Depends(get_db)):
    hoje = date.today()
    limite = hoje + timedelta(days=30)

    entradas = db.query(func.coalesce(func.sum(TransacaoBancaria.valor), 0)).filter(
        TransacaoBancaria.empresa_id == empresa_id, TransacaoBancaria.tipo == TipoTransacao.ENTRADA
    ).scalar()
    saidas = db.query(func.coalesce(func.sum(TransacaoBancaria.valor), 0)).filter(
        TransacaoBancaria.empresa_id == empresa_id, TransacaoBancaria.tipo == TipoTransacao.SAIDA
    ).scalar()

    def soma_lanc(tipo: TipoLancamento) -> float:
        return float(
            db.query(func.coalesce(func.sum(LancamentoFinanceiro.valor), 0))
            .filter(
                LancamentoFinanceiro.empresa_id == empresa_id,
                LancamentoFinanceiro.tipo == tipo,
                LancamentoFinanceiro.status == StatusLancamento.PENDENTE,
                LancamentoFinanceiro.data_vencimento <= limite,
            )
            .scalar()
        )

    pendencias = db.query(func.count(TransacaoBancaria.id)).filter(
        TransacaoBancaria.empresa_id == empresa_id,
        TransacaoBancaria.status_conciliacao.in_(
            [StatusConciliacao.PENDENTE, StatusConciliacao.SUGESTAO]
        ),
    ).scalar()

    vencidos = db.query(func.count(LancamentoFinanceiro.id)).filter(
        LancamentoFinanceiro.empresa_id == empresa_id,
        LancamentoFinanceiro.status == StatusLancamento.PENDENTE,
        LancamentoFinanceiro.data_vencimento < hoje,
    ).scalar()

    docs_erro = db.query(func.count(Documento.id)).filter(
        Documento.empresa_id == empresa_id,
        Documento.status_processamento == StatusProcessamento.ERRO,
    ).scalar()

    return {
        "saldo": float(entradas) - float(saidas),
        "a_receber_30d": soma_lanc(TipoLancamento.RECEBER),
        "a_pagar_30d": soma_lanc(TipoLancamento.PAGAR),
        "pendencias_conciliacao": pendencias,
        "lancamentos_vencidos": vencidos,
        "documentos_com_erro": docs_erro,
    }
