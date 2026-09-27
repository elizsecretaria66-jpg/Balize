"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS_MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conciliacao", label: "Conciliação Automática" },
  { href: "/contas-a-pagar-receber", label: "Contas a Pagar e Receber" },
  { href: "/documentos", label: "Gestão de Documentos" },
  { href: "/relatorios", label: "Relatórios Gerenciais" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex h-screen w-64 shrink-0 flex-col border-r px-4 py-6"
      style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}
    >
      <div className="mb-8 px-2">
        <span className="text-lg font-bold" style={{ color: "var(--cor-acento)" }}>
          Balize
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {ITENS_MENU.map((item) => {
          const ativo = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: ativo ? "var(--cor-acento-suave)" : "transparent",
                color: ativo ? "var(--cor-acento)" : "var(--cor-texto-suave)",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
