"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEmpresa } from "@/lib/empresa-context";
import {
  LayoutDashboard,
  RefreshCw,
  Receipt,
  FolderClosed,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

const ITENS_MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conciliacao", label: "Conciliação Automática", icon: RefreshCw },
  { href: "/contas-a-pagar-receber", label: "Contas a Pagar e Receber", icon: Receipt },
  { href: "/documentos", label: "Gestão de Documentos", icon: FolderClosed },
  { href: "/relatorios", label: "Relatórios Gerenciais", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { empresa, empresas, trocar } = useEmpresa();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-100 bg-white px-4 py-6">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-sm">
          <div className="h-3.5 w-3.5 rotate-45 rounded-[3px] bg-white/90" />
        </div>
        <span className="text-lg font-bold tracking-tight text-slate-900">Balize</span>
      </div>

      {/* Navegação */}
      <nav className="flex flex-col gap-1">
        {ITENS_MENU.map((item) => {
          const ativo = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                ativo
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {ativo && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500" />
              )}
              <Icon
                size={18}
                strokeWidth={2}
                className={ativo ? "text-emerald-600" : "text-slate-400"}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-100 px-2 pt-4">
        <p className="text-xs text-slate-400">Empresa</p>
        {empresas.length > 1 ? (
          <select
            value={empresa.id}
            onChange={(e) => trocar(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 truncate text-sm font-medium text-slate-700">{empresa.nome}</p>
        )}
      </div>
    </aside>
  );
}
