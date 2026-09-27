from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import UploadExtratoResponse
from app.services.ofx_service import processar_ofx
from app.services.pdf_extrato_service import processar_pdf_extrato

router = APIRouter(prefix="/api/v1/extratos", tags=["extratos"])


@router.post("/upload", response_model=UploadExtratoResponse)
async def upload_extrato(
    empresa_id: str,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    nome = (arquivo.filename or "").lower()

    if not nome.endswith((".ofx", ".pdf")):
        raise HTTPException(
            status_code=400,
            detail="Formato não suportado. Envie um arquivo .ofx ou .pdf.",
        )

    try:
        conteudo = await arquivo.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler o arquivo enviado.")

    if not conteudo:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    if nome.endswith(".ofx"):
        resultado = processar_ofx(conteudo, empresa_id, db)
    else:
        resultado = processar_pdf_extrato(conteudo, empresa_id, db)

    return UploadExtratoResponse(
        processados=resultado["processados"],
        duplicados_ignorados=resultado["duplicados_ignorados"],
        erros=resultado["erros"],
    )
