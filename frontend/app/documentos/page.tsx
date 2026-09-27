import { EmConstrucao } from "@/components/layout/em-construcao";

export default function PaginaDocumentos() {
  return (
    <EmConstrucao
      titulo="Gestão de Documentos"
      descricao="Repositório de notas, recibos e PDFs"
      itens={[
        "Listagem de todos os documentos enviados via OCR na Conciliação",
        "Busca e filtro por tipo (Nota Fiscal, Recibo, Boleto), status e período",
        "Reclassificação manual de tipo de documento",
        "Download do arquivo original",
      ]}
    />
  );
}
