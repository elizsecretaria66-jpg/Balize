"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { aplicarPlanoPadrao, criarEmpresa, listarEmpresas } from "./api";
import type { Empresa } from "./types";

interface Ctx {
  empresa: Empresa;
  empresas: Empresa[];
  trocar: (id: string) => void;
  recarregar: () => Promise<void>;
}

const EmpresaCtx = createContext<Ctx | null>(null);

export function useEmpresa() {
  const c = useContext(EmpresaCtx);
  if (!c) throw new Error("useEmpresa fora do EmpresaProvider");
  return c;
}

const CHAVE = "balize:empresa";

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(null);
    try {
      const lista = await listarEmpresas();
      setEmpresas(lista);
      const salva = typeof window !== "undefined" ? localStorage.getItem(CHAVE) : null;
      setSelecionada((atual) => {
        const alvo = atual ?? salva;
        return lista.find((e) => e.id === alvo)?.id ?? lista[0]?.id ?? null;
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar empresas.");
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function trocar(id: string) {
    setSelecionada(id);
    try {
      localStorage.setItem(CHAVE, id);
    } catch {}
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      const nova = await criarEmpresa({ nome: nome.trim(), cnpj: cnpj.trim() });
      await aplicarPlanoPadrao(nova.id);
      await recarregar();
      trocar(nova.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao cadastrar empresa.");
    } finally {
      setSalvando(false);
    }
  }

  const caixa = "mx-auto mt-24 max-w-md rounded-xl border border-slate-100 bg-white p-8 shadow-sm";

  if (erro && !empresas) {
    return (
      <div className={caixa}>
        <h1 className="text-lg font-semibold text-slate-900">Não foi possível conectar</h1>
        <p className="mt-2 text-sm text-slate-500">{erro}</p>
        <button
          onClick={recarregar}
          className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!empresas) return <p className="p-10 text-sm text-slate-500">Carregando…</p>;

  if (empresas.length === 0 || !selecionada) {
    return (
      <form onSubmit={cadastrar} className={caixa}>
        <h1 className="text-lg font-semibold text-slate-900">Cadastre sua empresa</h1>
        <p className="mt-1 text-sm text-slate-500">
          Primeiro acesso: informe os dados da empresa. Um Plano de Contas padrão será criado.
        </p>
        <input
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Razão social / nome"
          className="mt-5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          required
          value={cnpj}
          onChange={(e) => setCnpj(e.target.value)}
          placeholder="CNPJ (00.000.000/0000-00)"
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        {erro && <p className="mt-3 text-sm text-rose-600">{erro}</p>}
        <button
          disabled={salvando}
          className="mt-5 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Começar"}
        </button>
      </form>
    );
  }

  const empresa = empresas.find((e) => e.id === selecionada)!;
  return (
    <EmpresaCtx.Provider value={{ empresa, empresas, trocar, recarregar }}>
      {children}
    </EmpresaCtx.Provider>
  );
}
