from fastapi import FastAPI
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base
from app.routers import cadastros, comprovantes, conciliacao, extratos, financeiro, relatorios

# Cria as tabelas automaticamente no primeiro boot (equivale às migrations SQL).
Base.metadata.create_all(bind=engine)

# create_all não altera tabelas já existentes: garante a coluna adicionada depois.
try:
    with engine.begin() as _conn:
        _conn.execute(text('ALTER TABLE "Documentos" ADD COLUMN IF NOT EXISTS descricao VARCHAR(500)'))
except Exception as _e:  # noqa: BLE001
    print(f"Aviso: não foi possível atualizar a tabela Documentos: {_e}")

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
