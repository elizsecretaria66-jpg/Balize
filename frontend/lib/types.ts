export type StatusConciliacao = "PENDENTE" | "SUGESTAO" | "CONCILIADO";

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
