"use client";

import { useMemo, useState } from "react";
import { UploadZone } from "@/components/conciliacao/upload-zone";
import { TransacaoItem } from "@/components/conciliacao/transacao-item";
import { ComprovanteItem } from "@/components/conciliacao/comprovante-item";
import { uploadComprovante, uploadExtrato, processarConciliacao } from "@/lib/api";
import type { ComprovanteExtraido, TransacaoBancaria } from "@/lib/types";

// TODO: origem real da empresa logada (contexto de auth / sessão)
const EMPRESA_ID = "00000000-0000-0000-0000-000000000000";

export default function PaginaConciliacao() {
  const [transacoes, setTransacoes] = useState<TransacaoBancaria[]>([]);
  const [comprovantes, setComprovantes] = useState<ComprovanteExtraido[]>([]);

  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [carregandoComprovante, setCarregandoComprovante] = useState(false);
  const [processandoConciliacao, setProcessandoConciliacao] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  const pendentes = useMemo(
    () => transacoes.filter((t) => t.status_conciliacao === "PENDENTE").length,
    [transacoes]
  );
  const sugestoes = useMemo(
    () => transacoes.filter((t) => t.status_conciliacao === "SUGESTAO").length,
    [transacoes]
  );

  async function handleUploadExtrato(arquivos: File[]) {
    setMensagemErro(null);
    setCarregandoExtrato(true);
    try {
      for (const arquivo of arquivos) {
        await uploadExtrato(arquivo, EMPRESA_ID);
      }
      // Em produção: refetch de GET /api/v1/extratos?empresa_id=... para
      // trazer as transações recém-persistidas com seus IDs reais.
    } catch (e) {
      setMensagemErro(e instanceof Error ? e.message : "Não foi possível importar o extrato.");
    } finally {
      setCarregandoExtrato(false);
    }
  }

  async function handleUploadComprovante(arquivos: File[]) {
    setMensagemErro(null);
    setCarregandoComprovante(true);
    try {
      const novos: ComprovanteExtraido[] = [];
      for (const arquivo of arquivos) {
        novos.push(await uploadComprovante(arquivo, EMPRESA_ID));
      }
      setComprovantes((atual) => [...novos, ...atual]);
    } catch (e) {
      setMensagemErro(e instanceof Error ? e.message : "Não foi possível ler o comprovante.");
    } finally {
      setCarregandoComprovante(false);
    }
  }

  async function handleProcessarConciliacao() {
    setMensagemErro(null);
    setProcessandoConciliacao(true);
    try {
      await processarConciliacao(EMPRESA_ID);
      // Em produção: refetch da lista de transações para refletir os novos
      // status (CONCILIADO / SUGESTAO / categorizado).
    } catch (e) {
      setMensagemErro(e instanceof Error ? e.message : "Falha ao processar a conciliação.");
    } finally {
      setProcessandoConciliacao(false);
    }
  }

  function handleAprovarConciliacao(id: string) {
    setTransacoes((atual) =>
      atual.map((t) => (t.id === id ? { ...t, status_conciliacao: "CONCILIADO" } : t))
    );
  }

  function handleCategorizarManualmente(id: string) {
    // Abriria um seletor de categoria (Plano de Contas) — fora do escopo deste recorte.
    console.log("Categorizar manualmente:", id);
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10" style={{ background: "var(--cor-fundo)" }}>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cor-texto)" }}>
            Conciliação Bancária
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--cor-texto-suave)" }}>
            {pendentes} transações pendentes · {sugestoes} sugestões de match aguardando aprovação
          </p>
        </div>

        <button
          onClick={handleProcessarConciliacao}
          disabled={processandoConciliacao}
          className="rounded px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--cor-acento)" }}
        >
          {processandoConciliacao ? "Processando…" : "Rodar conciliação automática"}
        </button>
      </header>

      {mensagemErro && (
        <div
          className="mb-6 rounded px-4 py-3 text-sm"
          style={{ background: "var(--cor-erro-suave)", color: "var(--cor-erro)" }}
        >
          {mensagemErro}
        </div>
      )}

      <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <UploadZone
          titulo="Extrato bancário"
          descricao="Arraste aqui seu extrato (.OFX ou .PDF)"
          formatosAceitos=".ofx,.pdf"
          formatosLegiveis="OFX ou PDF"
          carregando={carregandoExtrato}
          onArquivos={handleUploadExtrato}
        />
        <UploadZone
          titulo="Comprovantes e notas"
          descricao="Arraste aqui recibos, notas ou boletos (.PDF, .PNG, .JPG)"
          formatosAceitos=".pdf,.png,.jpg,.jpeg"
          formatosLegiveis="PDF, PNG ou JPG"
          carregando={carregandoComprovante}
          onArquivos={handleUploadComprovante}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--cor-texto-suave)" }}>
            Transações do extrato
          </h2>
          <div className="border" style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}>
            {transacoes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--cor-texto-suave)" }}>
                Nenhuma transação importada ainda. Envie um extrato acima para começar.
              </p>
            ) : (
              transacoes.map((t) => (
                <TransacaoItem
                  key={t.id}
                  transacao={t}
                  onAprovarConciliacao={handleAprovarConciliacao}
                  onCategorizarManualmente={handleCategorizarManualmente}
                />
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--cor-texto-suave)" }}>
            Comprovantes lidos
          </h2>
          <div className="border" style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}>
            {comprovantes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--cor-texto-suave)" }}>
                Nenhum comprovante enviado ainda.
              </p>
            ) : (
              comprovantes.map((c) => <ComprovanteItem key={c.documento_id} comprovante={c} />)
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
