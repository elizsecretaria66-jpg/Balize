# Balize — Conciliação Bancária e Gestão Financeira

```
backend/   API FastAPI + PostgreSQL (OFX, PDF, OCR, conciliação, relatórios)
frontend/  Next.js (App Router) + Tailwind — publicado no Netlify
```

## Telas
Dashboard · Conciliação Automática · Contas a Pagar e Receber · Gestão de Documentos · Relatórios Gerenciais (DRE + DFC + CSV) · Configurações (empresa, Plano de Contas, regras De/Para).

No primeiro acesso o app pede o cadastro da empresa e já cria um Plano de Contas padrão.

## 1) Backend (precisa estar no ar para o site funcionar)
O Netlify só hospeda o frontend. Suba o `backend/` em Render, Railway ou Fly.io usando o `Dockerfile` (já inclui Tesseract) e crie um banco PostgreSQL no mesmo serviço.

Variáveis de ambiente do backend:
- `DATABASE_URL` = `postgresql+psycopg2://USUARIO:SENHA@HOST:5432/BANCO`
- `DIRETORIO_UPLOADS_COMPROVANTES` = `/data/comprovantes` (use um disco/volume persistente)

As tabelas são criadas automaticamente no primeiro boot. Os arquivos em `backend/migrations/*.sql` são apenas referência (não rode se já subiu o backend).

Rodar localmente:
```bash
cd backend
pip install -r requirements.txt        # e instale o Tesseract no sistema
export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/balize"
uvicorn app.main:app --reload
```
Documentação interativa da API: `http://localhost:8000/docs`

## 2) Frontend (Netlify)
- Base directory: `frontend` · Build command: `npm run build`
- Em **Site configuration → Environment variables** crie `NEXT_PUBLIC_API_URL` com a URL pública do backend (ex.: `https://balize-api.onrender.com`) e faça um novo deploy (a variável é gravada no build).

Local: `cd frontend && npm install && echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local && npm run dev`

## Pontos de atenção
- Sem autenticação: qualquer pessoa com a URL acessa os dados. Adicione login antes de usar com clientes reais.
- `CORSMiddleware` está com `allow_origins=["*"]`; restrinja ao domínio do Netlify em produção.
- A leitura de PDFs de extrato e o OCR dependem do layout de cada banco/comprovante — é a parte que exige ajuste fino com arquivos reais.
