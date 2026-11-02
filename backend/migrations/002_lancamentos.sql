-- Contas a Pagar / Receber
CREATE TYPE tipo_lancamento AS ENUM ('PAGAR', 'RECEBER');
CREATE TYPE status_lancamento AS ENUM ('PENDENTE', 'PAGO');

CREATE TABLE "LancamentosFinanceiros" (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id       UUID NOT NULL REFERENCES "Empresas"(id) ON DELETE CASCADE,
    tipo             tipo_lancamento NOT NULL,
    descricao        VARCHAR(255) NOT NULL,
    valor            NUMERIC(14, 2) NOT NULL,
    data_vencimento  DATE NOT NULL,
    data_pagamento   DATE,
    status           status_lancamento NOT NULL DEFAULT 'PENDENTE',
    categoria_id     UUID REFERENCES "PlanoDeContas"(id) ON DELETE SET NULL,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lancamentos_empresa ON "LancamentosFinanceiros"(empresa_id);
CREATE INDEX idx_lancamentos_vencimento ON "LancamentosFinanceiros"(data_vencimento);
