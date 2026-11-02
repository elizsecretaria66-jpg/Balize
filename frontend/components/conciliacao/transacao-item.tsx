import type { TransacaoBancaria } from "@/lib/types";
import { StatusBadge } from "./status-badge";

interface TransacaoItemProps {
  transacao: TransacaoBancaria;
  onAprovarConciliacao?: (id: string) => void;
  onCategorizarManualmente?: (id: string) => void;
  onExcluir?: (id: string) => void;
}

function formatarValor(valor: number, tipo: string) {
  // Verifica se o valor é negativo ou se o tipo é despesa / saída
  const ehDespesa = valor < 0 || tipo === "SAIDA" || tipo === "DESPESA" || tipo === "despesa";
  const sinal = ehDespesa ? "-" : "+";
  
  // Usa o valor absoluto para evitar problemas de sinal duplo
  const valorAbsoluto = Math.abs(valor);
  
  return `${sinal} R$ ${valorAbsoluto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function formatarData(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export function TransacaoItem({
  transacao,
  onAprovarConciliacao,
  onCategorizarManualmente,
  onExcluir,
}: TransacaoItemProps) {
  const ehSugestao = transacao.status_conciliacao === "SUGESTAO";

  return (
    <div
      className="flex items-start justify-between gap-4 border-b px-4 py-4"
      style={{
        borderColor: "var(--cor-linha)",
        borderLeft: ehSugestao ? "3px solid var(--cor-conciliado)" : "3px solid transparent",
        background: ehSugestao ? "var(--cor-conciliado-suave)" : "transparent",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-dado text-xs" style={{ color: "var(--cor-texto-suave)" }}>
            {formatarData(transacao.data)}
          </span>
          <StatusBadge status={transacao.status_conciliacao} />
        </div>
        <p className="mt-1 truncate text-sm" style={{ color: "var(--cor-texto)" }}>
          {transacao.descricao_extrato}
        </p>

        {ehSugestao && (
          <p className="mt-2 text-xs" style={{ color: "var(--cor-conciliado)" }}>
            Valor e data batem com um comprovante lido — confirme para conciliar.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          {ehSugestao && onAprovarConciliacao && (
            <button
              onClick={() => onAprovarConciliacao(transacao.id)}
              className="rounded px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--cor-conciliado)" }}
            >
              Aprovar conciliação
            </button>
          )}
          {transacao.status_conciliacao === "PENDENTE" && onCategorizarManualmente && (
            <button
              onClick={() => onCategorizarManualmente(transacao.id)}
              className="rounded border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5"
              style={{ borderColor: "var(--cor-linha)", color: "var(--cor-texto)" }}
            >
              Categorizar manualmente
            </button>
          )}
          {onExcluir && (
            <button
              onClick={() => onExcluir(transacao.id)}
              className="rounded px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      <span
        className="font-dado shrink-0 text-sm font-semibold"
        style={{ color: (transacao.valor < 0 || transacao.tipo === "SAIDA" || transacao.tipo === "DESPESA") ? "var(--cor-erro)" : "var(--cor-conciliado)" }}
      >
        {formatarValor(transacao.valor, transacao.tipo)}
      </span>
    </div>
  );
}
