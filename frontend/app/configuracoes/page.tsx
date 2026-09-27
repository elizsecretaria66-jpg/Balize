import { EmConstrucao } from "@/components/layout/em-construcao";

export default function PaginaConfiguracoes() {
  return (
    <EmConstrucao
      titulo="Configurações"
      descricao="Categorias, DRE customizada e regras de De/Para"
      itens={[
        "Edição do Plano de Contas (categorias de Receita/Despesa/Transferência)",
        "Regras de categorização automática (palavra-chave → categoria)",
        "Customização da estrutura da DRE Gerencial",
        "Dados cadastrais da Empresa",
      ]}
    />
  );
}
