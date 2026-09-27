from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Empresa
from app.schemas import ConciliacaoResultado
from app.services.conciliacao_service import processar_conciliacao

router = APIRouter(prefix="/api/v1/conciliacao", tags=["conciliacao"])


@router.post("/processar-empresa/{empresa_id}", response_model=ConciliacaoResultado)
def processar_empresa(empresa_id: str, db: Session = Depends(get_db)):
    empresa = db.query(Empresa).filter_by(id=empresa_id).first()
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")

    resultado = processar_conciliacao(empresa_id, db)
    return ConciliacaoResultado(**resultado)
