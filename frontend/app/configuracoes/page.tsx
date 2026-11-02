"use client";

import { useCallback, useEffect, useState } from "react";
import {
  aplicarPlanoPadrao, atualizarEmpresa, criarCategoria, criarRegra,
  excluirCategoria, excluirRegra, listarCategorias, listarRegras,
} from "@/lib/api";
import { useEmpresa } from "@/lib/empresa-context";
import type { Categoria, Regra } from "@/lib/types";

const campo = "rounded-lg border border-slate-200 px-3 py-2 text-sm";
const caixa = "mb-8 rounded-xl border border-slate-100 bg-white p-5 shadow-sm";
const btn = "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700";

export default function PaginaConfiguracoes() {
  const { empresa, recarregar } = useEmpresa();
  const [cats, setCats] = useState<Categoria[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [dados, setDados] = useState({ nome: empresa.nome, cnpj: empresa.cnpj });
  const [novaCat, setNovaCat] = useState({ codigo: "", nome_categoria: "", tipo: "DESPESA" });
  const [novaRegra, setNovaRegra] = useState({ palavra_chave: "", categoria_id_fk: "" });

  const carregar = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([listarCategorias(empresa.id), listarRegras(empresa.id)]);
      setCats(c);
      setRegras(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar.");
    }
  }, [empresa.id]);

  useEffect(() => {
    setDados({ nome: empresa.nome, cnpj: empresa.cnpj });
    carregar();
  }, [empresa, carregar]);

  async function agir(fn: () => Promise<unknown>, msg?: string) {
    setErro(null);
    setOk(null);
    try {
      await fn();
      await carregar();
      if (msg) setOk(msg);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro.");
    }
  }

  const nomeCat = (id: string) => cats.find((c) => c.id === id)?.nome_categoria ?? "—";

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500">Empresa, Plano de Contas e regras de categorização (De/Para)</p>
      </header>

      {erro && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</p>}
      {ok && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{ok}</p>}

      <section className={caixa}>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Dados da empresa</h2>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await atualizarEmpresa(empresa.id, dados);
              await recarregar();
            }, "Dados salvos.");
          }}
        >
          <input required value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} className={`${campo} min-w-[220px] flex-1`} />
          <input required value={dados.cnpj} onChange={(e) => setDados({ ...dados, cnpj: e.target.value })} className={campo} />
          <button className={btn}>Salvar</button>
        </form>
      </section>

      <section className={caixa}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Plano de Contas</h2>
          <button onClick={() => agir(() => aplicarPlanoPadrao(empresa.id), "Plano padrão aplicado.")} className="text-xs font-medium text-emerald-700 hover:underline">
            Aplicar plano padrão
          </button>
        </div>
        <form
          className="mb-4 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await criarCategoria(empresa.id, novaCat as Omit<Categoria, "id">);
              setNovaCat({ ...novaCat, codigo: "", nome_categoria: "" });
            });
          }}
        >
          <input required placeholder="Código (ex: 2.11)" value={novaCat.codigo} onChange={(e) => setNovaCat({ ...novaCat, codigo: e.target.value })} className={`${campo} w-32`} />
          <input required placeholder="Nome da categoria" value={novaCat.nome_categoria} onChange={(e) => setNovaCat({ ...novaCat, nome_categoria: e.target.value })} className={`${campo} min-w-[200px] flex-1`} />
          <select value={novaCat.tipo} onChange={(e) => setNovaCat({ ...novaCat, tipo: e.target.value })} className={campo}>
            <option value="RECEITA">Receita</option>
            <option value="DESPESA">Despesa</option>
            <option value="TRANSFERENCIA">Transferência</option>
          </select>
          <button className={btn}>Adicionar</button>
        </form>
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {cats.length === 0 && <tr><td className="py-6 text-center text-slate-500">Nenhuma categoria cadastrada.</td></tr>}
              {cats.map((c) => (
                <tr key={c.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{c.codigo}</td>
                  <td className="py-2">{c.nome_categoria}</td>
                  <td className="py-2 text-xs text-slate-500">{c.tipo === "RECEITA" ? "Receita" : c.tipo === "DESPESA" ? "Despesa" : "Transferência"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => agir(() => excluirCategoria(c.id))} className="text-xs text-slate-400 hover:text-rose-600">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={caixa}>
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Regras de categorização (De/Para)</h2>
        <p className="mb-3 text-xs text-slate-500">Se a descrição do extrato contiver a palavra-chave, a transação é categorizada automaticamente.</p>
        <form
          className="mb-4 flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await criarRegra(empresa.id, novaRegra);
              setNovaRegra({ ...novaRegra, palavra_chave: "" });
            });
          }}
        >
          <input required placeholder="Palavra-chave (ex: UBER)" value={novaRegra.palavra_chave} onChange={(e) => setNovaRegra({ ...novaRegra, palavra_chave: e.target.value })} className={`${campo} min-w-[200px] flex-1`} />
          <select required value={novaRegra.categoria_id_fk} onChange={(e) => setNovaRegra({ ...novaRegra, categoria_id_fk: e.target.value })} className={campo}>
            <option value="">Categoria…</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome_categoria}</option>)}
          </select>
          <button className={btn}>Adicionar regra</button>
        </form>
        <table className="w-full text-left text-sm">
          <tbody>
            {regras.length === 0 && <tr><td className="py-6 text-center text-slate-500">Nenhuma regra cadastrada.</td></tr>}
            {regras.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="py-2 font-mono text-xs">{r.palavra_chave}</td>
                <td className="py-2 text-slate-500">→ {nomeCat(r.categoria_id_fk)}</td>
                <td className="py-2 text-right">
                  <button onClick={() => agir(() => excluirRegra(r.id))} className="text-xs text-slate-400 hover:text-rose-600">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
