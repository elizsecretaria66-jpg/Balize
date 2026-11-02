"use client";

import { useEffect, useState } from "react";
import { obterDFC, obterDRE } from "@/lib/api";
import { brl, mesBR } from "@/lib/format";
import { useEmpresa } from "@/lib/empresa-context";
import type { DRE, LinhaDRE, MesDFC } from "@/lib/types";

const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm";
const ano = new Date().getFullYear();

function Bloco({ titulo, linhas, total, cor }: { titulo: string; linhas: LinhaDRE[]; total: number; cor: string }) {
  return (
    <>
      <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
        <td className="px-4 py-2" colSpan={3}>{titulo}</td>
      </tr>
      {linhas.map((l) => (
        <tr key={l.codigo} className="border-b border-slate-50">
          <td className="px-4 py-2 font-mono text-xs text-slate-400">{l.codigo}</td>
          <td className="px-4 py-2">{l.categoria}</td>
          <td className="px-4 py-2 text-right font-mono">{brl(l.valor)}</td>
        </tr>
      ))}
      <tr className="border-b border-slate-100 font-semibold">
        <td />
        <td className="px-4 py-2">Total de {titulo.toLowerCase()}</td>
        <td className={`px-4 py-2 text-right font-mono ${cor}`}>{brl(total)}</td>
      </tr>
    </>
  );
}

export default function PaginaRelatorios() {
  const { empresa } = useEmpresa();
  const [ini, setIni] = useState(`${ano}-01-01`);
  const [fim, setFim] = useState(`${ano}-12-31`);
  const [dre, setDre] = useState<DRE | null>(null);
  const [dfc, setDfc] = useState<MesDFC[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setErro(null);
    Promise.all([obterDRE(empresa.id, ini, fim), obterDFC(empresa.id, ini, fim)])
      .then(([r, f]) => {
        setDre(r);
        setDfc(f.meses);
      })
      .catch((e) => setErro(e.message));
  }, [empresa.id, ini, fim]);

  function exportarCSV() {
    if (!dre) return;
    const linhas = [
      ["Tipo", "Código", "Categoria", "Valor"],
      ...dre.receitas.map((l) => ["Receita", l.codigo, l.categoria, l.valor.toFixed(2)]),
      ...dre.despesas.map((l) => ["Despesa", l.codigo, l.categoria, l.valor.toFixed(2)]),
      ["Resultado", "", "", dre.resultado.toFixed(2)],
    ];
    const csv = linhas.map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `dre-${ini}-a-${fim}.csv`;
    a.click();
  }

  const maxFluxo = Math.max(1, ...dfc.flatMap((m) => [m.entradas, m.saidas]));
  const nc = dre?.nao_categorizado;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios Gerenciais</h1>
          <p className="mt-1 text-sm text-slate-500">DRE gerencial, margem e fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className={campo} />
          <span className="text-sm text-slate-400">até</span>
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
          <button onClick={exportarCSV} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Exportar CSV
          </button>
        </div>
      </header>

      {erro && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</p>}

      {dre && (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Receitas", brl(dre.total_receitas), "text-emerald-600"],
              ["Despesas", brl(dre.total_despesas), "text-rose-600"],
              ["Resultado · margem", `${brl(dre.resultado)} · ${dre.margem_percentual.toFixed(1)}%`, dre.resultado >= 0 ? "text-emerald-600" : "text-rose-600"],
            ].map(([t, v, c]) => (
              <div key={t} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-slate-500">{t}</p>
                <p className={`mt-1 font-mono text-xl font-semibold ${c}`}>{v}</p>
              </div>
            ))}
          </section>

          <section className="mb-8 overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">DRE Gerencial</h2>
            <table className="w-full text-sm">
              <tbody>
                <Bloco titulo="Receitas" linhas={dre.receitas} total={dre.total_receitas} cor="text-emerald-600" />
                <Bloco titulo="Despesas" linhas={dre.despesas} total={dre.total_despesas} cor="text-rose-600" />
                <tr className="font-bold">
                  <td />
                  <td className="px-4 py-3">Resultado do período</td>
                  <td className={`px-4 py-3 text-right font-mono ${dre.resultado >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(dre.resultado)}</td>
                </tr>
              </tbody>
            </table>
            {nc && (nc.entradas > 0 || nc.saidas > 0) && (
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-amber-600">
                Inclui transações sem categoria: {brl(nc.entradas)} em entradas e {brl(nc.saidas)} em saídas. Categorize-as na Conciliação para detalhar o DRE.
              </p>
            )}
          </section>
        </>
      )}

      <section className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Fluxo de Caixa (DFC) por mês</h2>
        {dfc.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Sem movimentações no período.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">Mês</th><th className="px-4 py-3">Entradas / Saídas</th>
                <th className="px-4 py-3 text-right">Saldo do mês</th><th className="px-4 py-3 text-right">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {dfc.map((m) => (
                <tr key={m.mes} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 capitalize">{mesBR(m.mes)}</td>
                  <td className="w-1/2 px-4 py-3">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="h-2 rounded bg-emerald-500" style={{ width: `${(m.entradas / maxFluxo) * 100}%` }} />
                      <span className="font-mono text-xs text-slate-500">{brl(m.entradas)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 rounded bg-rose-500" style={{ width: `${(m.saidas / maxFluxo) * 100}%` }} />
                      <span className="font-mono text-xs text-slate-500">{brl(m.saidas)}</span>
                    </div>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${m.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{brl(m.saldo)}</td>
                  <td className="px-4 py-3 text-right font-mono">{brl(m.acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
