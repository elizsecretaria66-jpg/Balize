import type { ComprovanteExtraido, UploadExtratoResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function uploadExtrato(
  arquivo: File,
  empresaId: string
): Promise<UploadExtratoResponse> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  const res = await fetch(
    `${API_BASE}/api/v1/extratos/upload?empresa_id=${empresaId}`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? "Falha ao enviar o extrato.");
  }

  return res.json();
}

export async function uploadComprovante(
  arquivo: File,
  empresaId: string
): Promise<ComprovanteExtraido> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);

  const res = await fetch(
    `${API_BASE}/api/v1/comprovantes/upload?empresa_id=${empresaId}`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(erro?.detail ?? "Falha ao processar o comprovante.");
  }

  const dados = await res.json();
  return { ...dados, nome_arquivo: arquivo.name };
}

export async function processarConciliacao(empresaId: string) {
  const res = await fetch(
    `${API_BASE}/api/v1/conciliacao/processar-empresa/${empresaId}`,
    { method: "POST" }
  );

  if (!res.ok) {
    throw new Error("Falha ao processar a conciliação.");
  }

  return res.json();
}
