-- Migração inicial: módulo de Conciliação Bancária
-- Execução: psql -d conciliacao_bancaria -f 001_create_tables.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE tipo_plano_contas AS ENUM ('RECEITA', 'DESPESA', 'TRANSFERENCIA');
CREATE TYPE tipo_transacao AS ENUM ('ENTRADA', 'SAIDA');
CREATE TYPE status_conciliacao AS ENUM ('PENDENTE', 'SUGESTAO', 'CONCILIADO');
CREATE TYPE status_processamento AS ENUM ('PENDENTE', 'PROCESSADO', 'ERRO');
CREATE TYPE tipo_documento AS ENUM ('NOTA_FISCAL', 'RECIBO', 'BOLETO');

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
CREATE TABLE "Empresas" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(255) NOT NULL,
    cnpj        VARCHAR(18) NOT NULL UNIQUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- PlanoDeContas
-- ---------------------------------------------------------------------
CREATE TABLE "PlanoDeContas" (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      UUID NOT NULL REFERENCES "Empresas"(id) ON DELETE CASCADE,
    codigo          VARCHAR(20) NOT NULL,
    nome_categoria  VARCHAR(120) NOT NULL,
    tipo            tipo_plano_contas NOT NULL,
    CONSTRAINT uq_plano_contas_empresa_codigo UNIQUE (empresa_id, codigo)
);

CREATE INDEX idx_plano_contas_empresa ON "PlanoDeContas"(empresa_id);

-- ---------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------
CREATE TABLE "Documentos" (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id              UUID NOT NULL REFERENCES "Empresas"(id) ON DELETE CASCADE,
    url_arquivo_local       VARCHAR(500) NOT NULL,
    data_emissao            DATE,
    valor_total             NUMERIC(14, 2),
    cnpj_emissor            VARCHAR(18),
    status_processamento    status_processamento NOT NULL DEFAULT 'PENDENTE',
    tipo_doc                tipo_documento NOT NULL,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_empresa ON "Documentos"(empresa_id);
CREATE INDEX idx_documentos_status ON "Documentos"(status_processamento);

-- ---------------------------------------------------------------------
-- TransacoesBancarias
-- ---------------------------------------------------------------------
CREATE TABLE "TransacoesBancarias" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES "Empresas"(id) ON DELETE CASCADE,
    fitid_ofx           VARCHAR(120) NOT NULL,
    data                DATE NOT NULL,
    descricao_extrato   VARCHAR(500) NOT NULL,
    valor               NUMERIC(14, 2) NOT NULL,
    tipo                tipo_transacao NOT NULL,
    status_conciliacao  status_conciliacao NOT NULL DEFAULT 'PENDENTE',
    documento_id_fk     UUID REFERENCES "Documentos"(id) ON DELETE SET NULL,
    categoria_id        UUID REFERENCES "PlanoDeContas"(id) ON DELETE SET NULL,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Garante que o mesmo extrato OFX subido duas vezes não duplique lançamentos,
    -- mas permite que fitids colidam entre empresas diferentes.
    CONSTRAINT uq_transacao_empresa_fitid UNIQUE (empresa_id, fitid_ofx)
);

CREATE INDEX idx_transacoes_empresa ON "TransacoesBancarias"(empresa_id);
CREATE INDEX idx_transacoes_status ON "TransacoesBancarias"(status_conciliacao);
CREATE INDEX idx_transacoes_fitid ON "TransacoesBancarias"(fitid_ofx);

-- ---------------------------------------------------------------------
-- RegrasCategorizacao
-- ---------------------------------------------------------------------
CREATE TABLE "RegrasCategorizacao" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          UUID NOT NULL REFERENCES "Empresas"(id) ON DELETE CASCADE,
    palavra_chave       VARCHAR(120) NOT NULL,
    categoria_id_fk     UUID NOT NULL REFERENCES "PlanoDeContas"(id) ON DELETE CASCADE
);

CREATE INDEX idx_regras_empresa ON "RegrasCategorizacao"(empresa_id);
CREATE INDEX idx_regras_palavra_chave ON "RegrasCategorizacao"(lower(palavra_chave));
