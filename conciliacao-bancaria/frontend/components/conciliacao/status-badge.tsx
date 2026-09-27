import type { StatusConciliacao } from "@/lib/types";

const CONFIG: Record<StatusConciliacao, { texto: string; cor: string; fundo: string }> = {
  PENDENTE: { texto: "Pendente", cor: "var(--cor-pendente)", fundo: "var(--cor-pendente-suave)" },
  SUGESTAO: { texto: "Sugestão de match", cor: "var(--cor-sugestao)", fundo: "var(--cor-sugestao-suave)" },
  CONCILIADO: { texto: "Conciliado", cor: "var(--cor-conciliado)", fundo: "var(--cor-conciliado-suave)" },
};

export function StatusBadge({ status }: { status: StatusConciliacao }) {
  const { texto, cor, fundo } = CONFIG[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: cor, background: fundo }}
    >
      {texto}
    </span>
  );
}
