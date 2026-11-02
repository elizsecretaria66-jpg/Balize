"""Relatórios gerenciais: DRE por categoria e DFC (fluxo de caixa) mensal."""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import PlanoDeContas, TipoPlanoContas, TipoTransacao, TransacaoBancaria

router = APIRouter(prefix="/api/v1/relatorios", tags=["relatorios"])


def _transacoes_periodo(db: Session, empresa_id: str, inicio: date | None, fim: date | None):
    q = db.query(TransacaoBancaria).filter_by(empresa_id=empresa_id)
    if inicio:
        q = q.filter(TransacaoBancaria.data >= inicio)
    if fim:
        q = q.filter(TransacaoBancaria.data <= fim)
    return q.all()


@router.get("/dre")
def dre(
    empresa_id: str,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
):
    categorias = {c.id: c for c in db.query(PlanoDeContas).filter_by(empresa_id=empresa_id).all()}
    linhas: dict[str, dict] = {}
    sem_categoria = {"entradas": 0.0, "saidas": 0.0}

    for t in _transacoes_periodo(db, empresa_id, data_inicio, data_fim):
        valor = float(t.valor)
        cat = categorias.get(t.categoria_id) if t.categoria_id else None
        if cat is None:
            chave = "entradas" if t.tipo == TipoTransacao.ENTRADA else "saidas"
            sem_categoria[chave] += valor
            continue
        if cat.tipo == TipoPlanoContas.TRANSFERENCIA:
            continue  # transferências não entram no resultado
        linha = linhas.setdefault(
            cat.id,
            {"codigo": cat.codigo, "categoria": cat.nome_categoria, "tipo": cat.tipo.value, "valor": 0.0},
        )
        linha["valor"] += valor

    receitas = sorted((l for l in linhas.values() if l["tipo"] == "RECEITA"), key=lambda l: l["codigo"])
    despesas = sorted((l for l in linhas.values() if l["tipo"] == "DESPESA"), key=lambda l: l["codigo"])

    total_receitas = sum(l["valor"] for l in receitas) + sem_categoria["entradas"]
    total_despesas = sum(l["valor"] for l in despesas) + sem_categoria["saidas"]
    resultado = total_receitas - total_despesas

    return {
        "receitas": receitas,
        "despesas": despesas,
        "nao_categorizado": sem_categoria,
        "total_receitas": total_receitas,
        "total_despesas": total_despesas,
        "resultado": resultado,
        "margem_percentual": (resultado / total_receitas * 100) if total_receitas else 0.0,
    }


@router.get("/dfc")
def dfc(
    empresa_id: str,
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: Session = Depends(get_db),
):
    meses: dict[str, dict] = defaultdict(lambda: {"entradas": 0.0, "saidas": 0.0})
    for t in _transacoes_periodo(db, empresa_id, data_inicio, data_fim):
        chave = t.data.strftime("%Y-%m")
        meses[chave]["entradas" if t.tipo == TipoTransacao.ENTRADA else "saidas"] += float(t.valor)

    acumulado = 0.0
    resultado = []
    for mes in sorted(meses):
        saldo = meses[mes]["entradas"] - meses[mes]["saidas"]
        acumulado += saldo
        resultado.append({"mes": mes, **meses[mes], "saldo": saldo, "acumulado": acumulado})
    return {"meses": resultado}
