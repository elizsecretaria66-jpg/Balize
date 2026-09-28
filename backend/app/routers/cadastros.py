"""Empresas, Plano de Contas e Regras de Categorização."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Empresa, PlanoDeContas, RegraCategorizacao, TipoPlanoContas

router = APIRouter(prefix="/api/v1", tags=["cadastros"])


# ---------- Empresas ----------
class EmpresaIn(BaseModel):
    nome: str
    cnpj: str


class EmpresaOut(EmpresaIn):
    id: str

    model_config = {"from_attributes": True}


@router.get("/empresas", response_model=list[EmpresaOut])
def listar_empresas(db: Session = Depends(get_db)):
    return db.query(Empresa).order_by(Empresa.nome).all()


@router.post("/empresas", response_model=EmpresaOut)
def criar_empresa(dados: EmpresaIn, db: Session = Depends(get_db)):
    if db.query(Empresa).filter_by(cnpj=dados.cnpj).first():
        raise HTTPException(400, "Já existe uma empresa com esse CNPJ.")
    empresa = Empresa(nome=dados.nome, cnpj=dados.cnpj)
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return empresa


@router.put("/empresas/{empresa_id}", response_model=EmpresaOut)
def atualizar_empresa(empresa_id: str, dados: EmpresaIn, db: Session = Depends(get_db)):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(404, "Empresa não encontrada.")
    empresa.nome, empresa.cnpj = dados.nome, dados.cnpj
    db.commit()
    return empresa


# ---------- Plano de Contas ----------
class CategoriaIn(BaseModel):
    codigo: str
    nome_categoria: str
    tipo: TipoPlanoContas


class CategoriaOut(CategoriaIn):
    id: str

    model_config = {"from_attributes": True}


@router.get("/plano-de-contas", response_model=list[CategoriaOut])
def listar_categorias(empresa_id: str, db: Session = Depends(get_db)):
    return (
        db.query(PlanoDeContas)
        .filter_by(empresa_id=empresa_id)
        .order_by(PlanoDeContas.codigo)
        .all()
    )


@router.post("/plano-de-contas", response_model=CategoriaOut)
def criar_categoria(empresa_id: str, dados: CategoriaIn, db: Session = Depends(get_db)):
    if db.query(PlanoDeContas).filter_by(empresa_id=empresa_id, codigo=dados.codigo).first():
        raise HTTPException(400, "Já existe uma categoria com esse código.")
    cat = PlanoDeContas(empresa_id=empresa_id, **dados.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/plano-de-contas/{categoria_id}", status_code=204)
def excluir_categoria(categoria_id: str, db: Session = Depends(get_db)):
    cat = db.get(PlanoDeContas, categoria_id)
    if not cat:
        raise HTTPException(404, "Categoria não encontrada.")
    db.delete(cat)
    db.commit()


# ---------- Regras de categorização (De/Para) ----------
class RegraIn(BaseModel):
    palavra_chave: str
    categoria_id_fk: str


class RegraOut(RegraIn):
    id: str

    model_config = {"from_attributes": True}


@router.get("/regras", response_model=list[RegraOut])
def listar_regras(empresa_id: str, db: Session = Depends(get_db)):
    return db.query(RegraCategorizacao).filter_by(empresa_id=empresa_id).all()


@router.post("/regras", response_model=RegraOut)
def criar_regra(empresa_id: str, dados: RegraIn, db: Session = Depends(get_db)):
    regra = RegraCategorizacao(
        empresa_id=empresa_id,
        palavra_chave=dados.palavra_chave.strip(),
        categoria_id_fk=dados.categoria_id_fk,
    )
    db.add(regra)
    db.commit()
    db.refresh(regra)
    return regra


@router.delete("/regras/{regra_id}", status_code=204)
def excluir_regra(regra_id: str, db: Session = Depends(get_db)):
    regra = db.get(RegraCategorizacao, regra_id)
    if not regra:
        raise HTTPException(404, "Regra não encontrada.")
    db.delete(regra)
    db.commit()


@router.post("/empresas/{empresa_id}/plano-padrao", status_code=204)
def aplicar_plano_padrao(empresa_id: str, db: Session = Depends(get_db)):
    """Aplica o Plano de Contas padrão + regras de exemplo (idempotente)."""
    if not db.get(Empresa, empresa_id):
        raise HTTPException(404, "Empresa não encontrada.")
    from migrations.seed_plano_de_contas import seed

    seed(empresa_id)
