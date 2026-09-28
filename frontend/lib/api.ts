import type {
  Categoria,
  ComprovanteExtraido,
  DashboardDados,
  Documento,
  DRE,
  Empresa,
  Lancamento,
  MesDFC,
  Regra,
  TransacaoBancaria,
  UploadExtratoResponse,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function req<T>(caminho: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${caminho}`, init);
  } catch {
    throw new Error("Não foi possível conectar ao servidor. Verifique se o backend está no ar.");
  }
  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    const detalhe = typeof erro?.detail === "string" ? erro.detail : null;
    throw new Error(detalhe ?? `Erro ${res.status} ao acessar o servidor.`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const json = (metodo: string, corpo?: unknown): RequestInit => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: corpo === undefined ? undefined : JSON.stringify(corpo),
});

const qs = (p: Record<string, string | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v && s.set(k, v));
  return s.toString();
};

// ---------- Empresas / cadastros ----------
export const listarEmpresas = () => req<Empresa[]>("/api/v1/empresas");
export const criarEmpresa = (d: { nome: string; cnpj: string }) =>
  req<Empresa>("/api/v1/empresas", json("POST", d));
export const atualizarEmpresa = (id: string, d: { nome: string; cnpj: string }) =>
  req<Empresa>(`/api/v1/empresas/${id}`, json("PUT", d));
export const aplicarPlanoPadrao = (id: string) =>
  req<void>(`/api/v1/empresas/${id}/plano-padrao`, { method: "POST" });

export const listarCategorias = (empresaId: string) =>
  req<Categoria[]>(`/api/v1/plano-de-contas?empresa_id=${empresaId}`);
export const criarCategoria = (empresaId: string, d: Omit<Categoria, "id">) =>
  req<Categoria>(`/api/v1/plano-de-contas?empresa_id=${empresaId}`, json("POST", d));
export const excluirCategoria = (id: string) =>
  req<void>(`/api/v1/plano-de-contas/${id}`, { method: "DELETE" });

export const listarRegras = (empresaId: string) =>
  req<Regra[]>(`/api/v1/regras?empresa_id=${empresaId}`);
export const criarRegra = (empresaId: string, d: Omit<Regra, "id">) =>
  req<Regra>(`/api/v1/regras?empresa_id=${empresaId}`, json("POST", d));
export const excluirRegra = (id: string) =>
  req<void>(`/api/v1/regras/${id}`, { method: "DELETE" });

// ---------- Extratos / comprovantes / conciliação ----------
export async function uploadExtrato(arquivo: File, empresaId: string) {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  return req<UploadExtratoResponse>(`/api/v1/extratos/upload?empresa_id=${empresaId}`, {
    method: "POST",
    body: fd,
  });
}

export async function uploadComprovante(arquivo: File, empresaId: string) {
  const fd = new FormData();
  fd.append("arquivo", arquivo);
  const dados = await req<Omit<ComprovanteExtraido, "nome_arquivo">>(
    `/api/v1/comprovantes/upload?empresa_id=${empresaId}`,
    { method: "POST", body: fd }
  );
  return { ...dados, nome_arquivo: arquivo.name } as ComprovanteExtraido;
}

export const processarConciliacao = (empresaId: string) =>
  req<{ conciliados: number; sugestoes: number; categorizados_automaticamente: number; sem_match: number }>(
    `/api/v1/conciliacao/processar-empresa/${empresaId}`,
    { method: "POST" }
  );

export const listarTransacoes = (empresaId: string) =>
  req<TransacaoBancaria[]>(`/api/v1/transacoes?empresa_id=${empresaId}`);
export const aprovarConciliacao = (id: string) =>
  req<TransacaoBancaria>(`/api/v1/transacoes/${id}/aprovar`, { method: "POST" });
export const categorizarTransacao = (id: string, categoriaId: string) =>
  req<TransacaoBancaria>(`/api/v1/transacoes/${id}/categorizar`, json("POST", { categoria_id: categoriaId }));

// ---------- Documentos ----------
export const listarDocumentos = (
  empresaId: string,
  f: { tipo_doc?: string; status?: string; data_inicio?: string; data_fim?: string } = {}
) => req<Documento[]>(`/api/v1/documentos?${qs({ empresa_id: empresaId, ...f })}`);
export const reclassificarDocumento = (id: string, tipo_doc: string) =>
  req<Documento>(`/api/v1/documentos/${id}`, json("PATCH", { tipo_doc }));

// ---------- Lançamentos ----------
export const listarLancamentos = (empresaId: string) =>
  req<Lancamento[]>(`/api/v1/lancamentos?empresa_id=${empresaId}`);
export const criarLancamento = (
  empresaId: string,
  d: { tipo: string; descricao: string; valor: number; data_vencimento: string; categoria_id?: string | null }
) => req<Lancamento>(`/api/v1/lancamentos?empresa_id=${empresaId}`, json("POST", d));
export const baixarLancamento = (id: string) =>
  req<Lancamento>(`/api/v1/lancamentos/${id}/baixar`, { method: "POST" });
export const excluirLancamento = (id: string) =>
  req<void>(`/api/v1/lancamentos/${id}`, { method: "DELETE" });

// ---------- Dashboard / relatórios ----------
export const obterDashboard = (empresaId: string) =>
  req<DashboardDados>(`/api/v1/dashboard?empresa_id=${empresaId}`);
export const obterDRE = (empresaId: string, ini?: string, fim?: string) =>
  req<DRE>(`/api/v1/relatorios/dre?${qs({ empresa_id: empresaId, data_inicio: ini, data_fim: fim })}`);
export const obterDFC = (empresaId: string, ini?: string, fim?: string) =>
  req<{ meses: MesDFC[] }>(`/api/v1/relatorios/dfc?${qs({ empresa_id: empresaId, data_inicio: ini, data_fim: fim })}`);
