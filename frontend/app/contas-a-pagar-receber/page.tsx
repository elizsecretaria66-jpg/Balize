import { EmConstrucao } from "@/components/layout/em-construcao";

export default function PaginaContasPagarReceber() {
  return (
    <EmConstrucao
      titulo="Contas a Pagar e Receber"
      descricao="Fluxo de caixa operacional"
      itens={[
        "Lançamentos futuros de contas a pagar e a receber",
        "Projeção de fluxo de caixa por período",
        "Alertas de vencimento",
        "Vínculo com o Plano de Contas para categorização",
      ]}
    />
  );
}
