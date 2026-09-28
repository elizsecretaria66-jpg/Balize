"use client";

import { useCallback, useEffect, useState } from "react";
import { listarDocumentos, reclassificarDocumento } from "@/lib/api";
import { brl, dataBR } from "@/lib/format";
import { useEmpresa } from "@/lib/empresa-context";
import type { Documento } from "@/lib/types";

const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm";
const STATUS_COR: Record<string, string> = {
  PROCESSADO: "bg-emerald-50 text-emerald-700",
  PENDENTE: "bg-amber-50 text-amber-600",
  ERRO: "bg-rose-50 text-rose-600",
};
const TIPOS = { NOTA_FISCAL: "Nota Fiscal", RECIBO: "Recibo", BOLETO: "Boleto" } as const;

export default function PaginaDocumentos() {
  const { empresa } = useEmpresa();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [f, setF] = useState({ tipo_doc: "", status: "", data_inicio: "", data_fim: "" });

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setDocs(await listarDocumentos(empresa.id, f));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar documentos.");
    }
  }, [empresa.id, f]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Documentos</h1>
        <p className="mt-1 text-sm text-slate-500">Comprovantes enviados e lidos por OCR</p>
      </header>

      {erro && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <select value={f.tipo_doc} onChange={(e) => setF({ ...f, tipo_doc: e.target.value })} className={campo}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={campo}>
          <option value="">Todos os status</option>
          <option value="PROCESSADO">Processado</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ERRO">Com erro</option>
        </select>
        <input type="date" value={f.data_inicio} onChange={(e) => setF({ ...f, data_inicio: e.target.value })} className={campo} />
        <input type="date" value={f.data_fim} onChange={(e) => setF({ ...f, data_fim: e.target.value })} className={campo} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Arquivo</th><th className="px-4 py-3">Emissão</th><th className="px-4 py-3">CNPJ/CPF</th>
              <th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum documento encontrado.</td></tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-slate-50 last:border-0">
                <td className="max-w-[220px] truncate px-4 py-3 text-slate-800">{d.url_arquivo_local.split("/").pop()}</td>
                <td className="px-4 py-3 font-mono text-xs">{dataBR(d.data_emissao)}</td>
                <td className="px-4 py-3 font-mono text-xs">{d.cnpj_emissor ?? "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{d.valor_total != null ? brl(d.valor_total) : "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={d.tipo_doc}
                    onChange={async (e) => {
                      try {
                        await reclassificarDocumento(d.id, e.target.value);
                        await carregar();
                      } catch (err) {
                        setErro(err instanceof Error ? err.message : "Erro ao reclassificar.");
                      }
                    }}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COR[d.status_processamento]}`}>
                    {d.status_processamento === "ERRO" ? "Erro de leitura" : d.status_processamento === "PROCESSADO" ? "Processado" : "Pendente"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
