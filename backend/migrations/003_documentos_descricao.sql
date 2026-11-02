-- Descrição lida do comprovante (ex.: "Compra em mercado").
-- O backend já executa isso sozinho ao iniciar; o arquivo é só referência.
ALTER TABLE "Documentos" ADD COLUMN IF NOT EXISTS descricao VARCHAR(500);
