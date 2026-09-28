"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowDownLeft, ArrowUpRight, Inbox, Wallet } from "lucide-react";
import { obterDashboard } from "@/lib/api";
import { brl } from "@/lib/format";
import { useEmpresa } from "@/lib/empresa-context";
import type { DashboardDados } from "@/lib/types";

export default function PaginaDashboard() {
  const { empresa } = useEmpresa();
  const [d, setD] = useState<DashboardDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterDashboard(empresa.id).then(setD).catch((e) => setErro(e.message));
  }, [empresa.id]);

  const kpis = [
    { label: "Saldo em contas", valor: d ? brl(d.saldo) : "—", nota: "Entradas − saídas dos extratos importados", icon: Wallet, bg: "bg-blue-50", cor: "text-blue-600" },
    { label: "A receber (30 dias)", valor: d ? brl(d.a_receber_30d) : "—", nota: "Lançamentos pendentes", icon: ArrowUpRight, bg: "bg-emerald-50", cor: "text-emerald-500" },
    { label: "A pagar (30 dias)", valor: d ? brl(d.a_pagar_30d) : "—", nota: "Lançamentos pendentes", icon: ArrowDownLeft, bg: "bg-rose-50", cor: "text-rose-500" },
    { label: "Pendências de conciliação", valor: d ? String(d.pendencias_conciliacao) : "—", nota: "Transações aguardando ação", icon: AlertCircle, bg: "bg-amber-50", cor: "text-amber-500", destaque: true },
  ];

  const alertas: { texto: string; href: string }[] = [];
  if (d?.lancamentos_vencidos) alertas.push({ texto: `${d.lancamentos_vencidos} conta(s) vencida(s) sem baixa`, href: "/contas-a-pagar-receber" });
  if (d?.pendencias_conciliacao) alertas.push({ texto: `${d.pendencias_conciliacao} transação(ões) pendente(s) de conciliação`, href: "/conciliacao" });
  if (d?.documentos_com_erro) alertas.push({ texto: `${d.documentos_com_erro} documento(s) com erro de leitura`, href: "/documentos" });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Visão Geral</h1>
        <p className="mt-1 text-sm text-slate-500">{empresa.nome}</p>
      </header>

      {erro && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</p>}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${k.bg}`}>
                <Icon size={20} className={k.cor} strokeWidth={2.25} />
              </div>
              <p className="mt-4 text-xs font-medium text-slate-500">{k.label}</p>
              <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${k.destaque ? "text-amber-600" : "text-slate-900"}`}>{k.valor}</p>
              <p className="mt-1 text-xs text-slate-400">{k.nota}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Alertas</h2>
        {alertas.length > 0 ? (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white shadow-sm">
            {alertas.map((a) => (
              <Link key={a.texto} href={a.href} className="flex items-center gap-3 px-5 py-4 text-sm text-slate-700 transition-colors hover:bg-slate-50">
                <AlertTriangle size={18} className="text-amber-500" />
                {a.texto}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100">
              <Inbox size={26} className="text-sky-500" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium text-slate-700">Tudo tranquilo por aqui</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Alertas de vencimento, documentos com erro e transações pendentes aparecem aqui.
            </p>
            <Link href="/conciliacao" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
              Importar extrato agora
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
