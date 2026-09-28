export type StatusConciliacao = "PENDENTE" | "SUGESTAO" | "CONCILIADO";
export type TipoPlanoContas = "RECEITA" | "DESPESA" | "TRANSFERENCIA";
export type TipoDocumento = "NOTA_FISCAL" | "RECIBO" | "BOLETO";
export type StatusProcessamento = "PENDENTE" | "PROCESSADO" | "ERRO";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
}

export interface TransacaoBancaria {
  id: string;
  data: string; // ISO date
  descricao_extrato: string;
  valor: number;
  tipo: "ENTRADA" | "SAIDA";
  status_conciliacao: StatusConciliacao;
  documento_id_fk: string | null;
  categoria_id: string | null;
}

export interface Documento {
  id: string;
  url_arquivo_local: string;
  data_emissao: string | null;
  valor_total: number | null;
  cnpj_emissor: string | null;
  status_processamento: StatusProcessamento;
  tipo_doc: TipoDocumento;
}

export interface ComprovanteExtraido {
  documento_id: string;
  valor_total: number | null;
  data_emissao: string | null;
  cnpj_cpf: string | null;
  confianca_extracao: "ALTA" | "PARCIAL" | "BAIXA";
  nome_arquivo: string;
}

export interface UploadExtratoResponse {
  processados: number;
  duplicados_ignorados: number;
  erros: string[];
}

export interface Categoria {
  id: string;
  codigo: string;
  nome_categoria: string;
  tipo: TipoPlanoContas;
}

export interface Regra {
  id: string;
  palavra_chave: string;
  categoria_id_fk: string;
}

export interface Lancamento {
  id: string;
  tipo: "PAGAR" | "RECEBER";
  descricao: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: "PENDENTE" | "PAGO";
  categoria_id: string | null;
}

export interface DashboardDados {
  saldo: number;
  a_receber_30d: number;
  a_pagar_30d: number;
  pendencias_conciliacao: number;
  lancamentos_vencidos: number;
  documentos_com_erro: number;
}

export interface LinhaDRE {
  codigo: string;
  categoria: string;
  tipo: string;
  valor: number;
}

export interface DRE {
  receitas: LinhaDRE[];
  despesas: LinhaDRE[];
  nao_categorizado: { entradas: number; saidas: number };
  total_receitas: number;
  total_despesas: number;
  resultado: number;
  margem_percentual: number;
}

export interface MesDFC {
  mes: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
}
