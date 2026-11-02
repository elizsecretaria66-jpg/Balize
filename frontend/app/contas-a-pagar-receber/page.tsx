"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { baixarLancamento, criarLancamento, excluirLancamento, listarCategorias, listarLancamentos } from "@/lib/api";
import { brl, dataBR } from "@/lib/format";
import { useEmpresa } from "@/lib/empresa-context";
import type { Categoria, Lancamento } from "@/lib/types";

const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm";

export default function PaginaContas() {
  const { empresa } = useEmpresa();
  const [itens, setItens] = useState<Lancamento[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [aba, setAba] = useState<"TODOS" | "PAGAR" | "RECEBER">("TODOS");
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({ tipo: "PAGAR", descricao: "", valor: "", data_vencimento: "", categoria_id: "" });

  const carregar = useCallback(async () => {
    try {
      const [l, c] = await Promise.all([listarLancamentos(empresa.id), listarCategorias(empresa.id)]);
      setItens(l);
      setCats(c);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [empresa.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(fn: () => Promise<unknown>) {
    setErro(null);
    try {
      await fn();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    await agir(async () => {
      await criarLancamento(empresa.id, {
        tipo: form.tipo,
        descricao: form.descricao,
        valor: Number(form.valor.replace(",", ".")),
        data_vencimento: form.data_vencimento,
        categoria_id: form.categoria_id || null,
      });
      setForm({ ...form, descricao: "", valor: "" });
    });
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const visiveis = useMemo(() => itens.filter((i) => aba === "TODOS" || i.tipo === aba), [itens, aba]);
  const total = (t: "PAGAR" | "RECEBER") =>
    itens.filter((i) => i.tipo === t && i.status === "PENDENTE").reduce((s, i) => s + i.valor, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Contas a Pagar e Receber</h1>
        <p className="mt-1 text-sm text-slate-500">
          A receber pendente: <b className="text-emerald-600">{brl(total("RECEBER"))}</b> · A pagar pendente:{" "}
          <b className="text-rose-600">{brl(total("PAGAR"))}</b>
        </p>
      </header>

      {erro && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</p>}

      <form onSubmit={salvar} className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm md:grid-cols-6">
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={campo}>
          <option value="PAGAR">A pagar</option>
          <option value="RECEBER">A receber</option>
        </select>
        <input required placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={`${campo} md:col-span-2`} />
        <input required placeholder="Valor (R$)" inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className={campo} />
        <input required type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} className={campo} />
        <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className={campo}>
          <option value="">Sem categoria</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.codigo} · {c.nome_categoria}</option>
          ))}
        </select>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 md:col-span-6 md:justify-self-end">
          Adicionar lançamento
        </button>
      </form>

      <div className="mb-3 flex gap-2">
        {(["TODOS", "PAGAR", "RECEBER"] as const).map((a) => (
          <button key={a} onClick={() => setAba(a)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${aba === a ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}>
            {a === "TODOS" ? "Todos" : a === "PAGAR" ? "A pagar" : "A receber"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Nenhum lançamento ainda.</td></tr>
            )}
            {visiveis.map((i) => {
              const vencido = i.status === "PENDENTE" && i.data_vencimento < hoje;
              return (
                <tr key={i.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{dataBR(i.data_vencimento)}</td>
                  <td className="px-4 py-3 text-slate-800">{i.descricao}</td>
                  <td className="px-4 py-3">{i.tipo === "PAGAR" ? "A pagar" : "A receber"}</td>
                  <td className={`px-4 py-3 text-right font-mono ${i.tipo === "PAGAR" ? "text-rose-600" : "text-emerald-600"}`}>{brl(i.valor)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${i.status === "PAGO" ? "bg-emerald-50 text-emerald-700" : vencido ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}>
                      {i.status === "PAGO" ? (i.tipo === "PAGAR" ? "Pago" : "Recebido") : vencido ? "Vencido" : "Pendente"}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    {i.status === "PENDENTE" && (
                      <button onClick={() => agir(() => baixarLancamento(i.id))} className="text-xs font-medium text-emerald-700 hover:underline">
                        Dar baixa
                      </button>
                    )}
                    <button onClick={() => agir(() => excluirLancamento(i.id))} className="text-xs text-slate-400 hover:text-rose-600">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
