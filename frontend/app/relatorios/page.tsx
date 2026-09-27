import { EmConstrucao } from "@/components/layout/em-construcao";

export default function PaginaRelatorios() {
  return (
    <EmConstrucao
      titulo="Relatórios Gerenciais"
      descricao="DRE Gerencial, margem e DFC"
      itens={[
        "DRE Gerencial por período e por categoria do Plano de Contas",
        "Análise de margem",
        "Demonstrativo de Fluxo de Caixa (DFC)",
        "Exportação em PDF/Excel",
      ]}
    />
  );
}
