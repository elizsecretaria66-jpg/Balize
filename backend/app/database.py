import os
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/conciliacao_bancaria",
).strip()

# Aceita qualquer formato de URL que os provedores entregam
# (postgres://, postgresql://, postgresql+psycopg://...) e força o driver psycopg2.
DATABASE_URL = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql+psycopg2://", DATABASE_URL)

# Remove o parâmetro channel_binding que o Neon inclui (pode causar erro de conexão).
_partes = urlsplit(DATABASE_URL)
_query = urlencode([(k, v) for k, v in parse_qsl(_partes.query) if k != "channel_binding"])
DATABASE_URL = urlunsplit(_partes._replace(query=_query))

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """Dependency do FastAPI: fornece uma sessão por request e garante o fechamento."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
