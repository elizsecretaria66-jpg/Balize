import type { ComprovanteExtraido } from "@/lib/types";

const CONFIANCA_CONFIG = {
  ALTA: { texto: "Leitura completa", cor: "var(--cor-conciliado)", fundo: "var(--cor-conciliado-suave)" },
  PARCIAL: { texto: "Leitura parcial", cor: "var(--cor-sugestao)", fundo: "var(--cor-sugestao-suave)" },
  BAIXA: { texto: "Confira os dados", cor: "var(--cor-erro)", fundo: "var(--cor-erro-suave)" },
} as const;

export function ComprovanteItem({ comprovante }: { comprovante: ComprovanteExtraido }) {
  const confianca = CONFIANCA_CONFIG[comprovante.confianca_extracao];

  return (
    <div className="border-b px-4 py-4" style={{ borderColor: "var(--cor-linha)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium" style={{ color: "var(--cor-texto)" }}>
          {comprovante.nome_arquivo}
        </p>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{ color: confianca.cor, background: confianca.fundo }}
        >
          {confianca.texto}
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <dt style={{ color: "var(--cor-texto-suave)" }}>Valor total</dt>
        <dd className="font-dado text-right" style={{ color: "var(--cor-texto)" }}>
          {comprovante.valor_total != null
            ? `R$ ${comprovante.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
            : "Não identificado"}
        </dd>

        <dt style={{ color: "var(--cor-texto-suave)" }}>Data de emissão</dt>
        <dd className="font-dado text-right" style={{ color: "var(--cor-texto)" }}>
          {comprovante.data_emissao
            ? new Date(comprovante.data_emissao + "T00:00:00").toLocaleDateString("pt-BR")
            : "Não identificada"}
        </dd>

        <dt style={{ color: "var(--cor-texto-suave)" }}>CNPJ/CPF</dt>
        <dd className="font-dado text-right" style={{ color: "var(--cor-texto)" }}>
          {comprovante.cnpj_cpf ?? "Não identificado"}
        </dd>
      </dl>
    </div>
  );
}
