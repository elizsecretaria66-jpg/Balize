from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base
from app.routers import cadastros, comprovantes, conciliacao, extratos, financeiro, relatorios

# Cria as tabelas automaticamente no primeiro boot (equivale às migrations SQL).
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API de Conciliação Bancária",
    description="Upload de extratos (OFX/PDF), OCR de comprovantes e conciliação automática.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrinja em produção ao domínio do frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extratos.router)
app.include_router(comprovantes.router)
app.include_router(conciliacao.router)
app.include_router(cadastros.router)
app.include_router(financeiro.router)
app.include_router(relatorios.router)


@app.get("/health")
def health():
    return {"status": "ok"}
