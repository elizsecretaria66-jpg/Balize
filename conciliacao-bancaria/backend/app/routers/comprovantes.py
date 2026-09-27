from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ComprovanteExtraidoResponse
from app.services.ocr_service import processar_comprovante

router = APIRouter(prefix="/api/v1/comprovantes", tags=["comprovantes"])


@router.post("/upload", response_model=ComprovanteExtraidoResponse)
async def upload_comprovante(
    empresa_id: str,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nome = (arquivo.filename or "").lower()
    if not nome.endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise HTTPException(
            status_code=400,
            detail="Formato não suportado. Envie PDF, PNG ou JPG.",
        )

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    try:
        resultado = processar_comprovante(conteudo, nome, empresa_id, db)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return ComprovanteExtraidoResponse(**resultado)
