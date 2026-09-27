# Módulo de Conciliação Bancária

## Backend (FastAPI + SQLAlchemy + PostgreSQL)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Tesseract precisa estar instalado no SO para o OCR funcionar:
#   Ubuntu/Debian: sudo apt-get install tesseract-ocr tesseract-ocr-por
#   macOS:         brew install tesseract tesseract-lang

createdb conciliacao_bancaria
psql -d conciliacao_bancaria -f migrations/001_create_tables.sql

# Cria uma empresa manualmente (ou via endpoint próprio) e rode o seed:
python -m migrations.seed_plano_de_contas <empresa_id>

export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/conciliacao_bancaria"
uvicorn app.main:app --reload
```

Endpoints disponíveis:
- `POST /api/v1/extratos/upload?empresa_id=...` — upload de `.ofx` ou `.pdf`
- `POST /api/v1/comprovantes/upload?empresa_id=...` — upload de `.pdf/.png/.jpg`
- `POST /api/v1/conciliacao/processar-empresa/{empresa_id}` — roda o matching

**Gaps conhecidos (fora do escopo pedido, mas necessários antes de produção):**
- Não há endpoints `GET` de listagem (transações/documentos) — o frontend
  hoje só reflete o que a própria sessão enviou. Adicione
  `GET /api/v1/extratos?empresa_id=` e `GET /api/v1/comprovantes?empresa_id=`
  para popular a tela ao carregar/recarregar a página.
- Não há endpoint para criar `Empresas`, `PlanoDeContas` (fora do seed) nem
  `RegrasCategorizacao` via API — hoje só existem via seed/SQL direto.
- Autenticação/multi-tenant: `empresa_id` está sendo passado "cru" via query
  param; em produção isso deve vir do contexto de autenticação, não do client.

## Frontend (Next.js App Router + Tailwind)

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Abra `http://localhost:3000/conciliacao`.

Observação: os componentes usam classes Tailwind + tokens em CSS custom
properties, no estilo do shadcn/ui, mas sem depender da CLI do shadcn (que
não roda neste ambiente). Para adotar o shadcn de fato, rode
`npx shadcn@latest init` no projeto e migre `Button`/`Badge`/`Card` para os
componentes gerados, mantendo os tokens de cor definidos em `globals.css`.
