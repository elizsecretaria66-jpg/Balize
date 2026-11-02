from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import DocumentoOut, UploadComprovanteResponse
from app.services.ocr_service import processar_comprovante

router = APIRouter(prefix="/api/v1/comprovantes", tags=["comprovantes"])


@router.post("/upload", response_model=UploadComprovanteResponse)
async def upload_comprovante(
    empresa_id: str,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nome = arquivo.filename or ""
    if not nome.lower().endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie PDF, PNG ou JPG.")

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    try:
        r = processar_comprovante(conteudo, nome, empresa_id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return UploadComprovanteResponse(
        lidos=r["lidos"],
        duplicados_ignorados=r["duplicados_ignorados"],
        erros=r["erros"],
        documentos=[DocumentoOut.model_validate(d) for d in r["documentos"]],
    )
