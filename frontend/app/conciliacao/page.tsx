"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UploadZone } from "@/components/conciliacao/upload-zone";
import { TransacaoItem } from "@/components/conciliacao/transacao-item";
import { ComprovanteItem } from "@/components/conciliacao/comprovante-item";
import {
  aprovarConciliacao, categorizarTransacao, listarCategorias, listarDocumentos,
  listarTransacoes, processarConciliacao, uploadComprovante, uploadExtrato,
} from "@/lib/api";
import { useEmpresa } from "@/lib/empresa-context";
import type { Categoria, ComprovanteExtraido, Documento, TransacaoBancaria } from "@/lib/types";

function documentoParaCard(d: Documento): ComprovanteExtraido {
  const lidos = [d.valor_total, d.data_emissao, d.cnpj_emissor].filter((x) => x != null).length;
  return {
    documento_id: d.id,
    valor_total: d.valor_total,
    data_emissao: d.data_emissao,
    cnpj_cpf: d.cnpj_emissor,
    confianca_extracao: lidos === 3 ? "ALTA" : lidos > 0 ? "PARCIAL" : "BAIXA",
    nome_arquivo: d.url_arquivo_local.split("/").pop() ?? "documento",
  };
}

export default function PaginaConciliacao() {
  const { empresa } = useEmpresa();
  const [transacoes, setTransacoes] = useState<TransacaoBancaria[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [carregandoComprovante, setCarregandoComprovante] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [categorizandoId, setCategorizandoId] = useState<string | null>(null);
  const [categoriaEscolhida, setCategoriaEscolhida] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [t, d, c] = await Promise.all([
        listarTransacoes(empresa.id),
        listarDocumentos(empresa.id),
        listarCategorias(empresa.id),
      ]);
      setTransacoes(t);
      setDocumentos(d);
      setCategorias(c);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados.");
    }
  }, [empresa.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pendentes = useMemo(() => transacoes.filter((t) => t.status_conciliacao === "PENDENTE").length, [transacoes]);
  const sugestoes = useMemo(() => transacoes.filter((t) => t.status_conciliacao === "SUGESTAO").length, [transacoes]);

  async function enviarExtratos(arquivos: File[]) {
    setErro(null);
    setAviso(null);
    setCarregandoExtrato(true);
    try {
      let novos = 0, dup = 0;
      const problemas: string[] = [];
      for (const a of arquivos) {
        const r = await uploadExtrato(a, empresa.id);
        novos += r.processados;
        dup += r.duplicados_ignorados;
        problemas.push(...r.erros);
      }
      setAviso(`${novos} transação(ões) importada(s), ${dup} duplicada(s) ignorada(s).`);
      if (problemas.length) setErro(problemas.join(" "));
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível importar o extrato.");
    } finally {
      setCarregandoExtrato(false);
    }
  }

  async function enviarComprovantes(arquivos: File[]) {
    setErro(null);
    setAviso(null);
    setCarregandoComprovante(true);
    try {
      for (const a of arquivos) await uploadComprovante(a, empresa.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o comprovante.");
    } finally {
      setCarregandoComprovante(false);
    }
  }

  async function rodarConciliacao() {
    setErro(null);
    setProcessando(true);
    try {
      const r = await processarConciliacao(empresa.id);
      setAviso(`${r.conciliados} conciliada(s), ${r.sugestoes} sugestão(ões), ${r.categorizados_automaticamente} categorizada(s) por regra, ${r.sem_match} sem correspondência.`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar a conciliação.");
    } finally {
      setProcessando(false);
    }
  }

  async function aprovar(id: string) {
    try {
      await aprovarConciliacao(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao aprovar.");
    }
  }

  async function confirmarCategoria() {
    if (!categorizandoId || !categoriaEscolhida) return;
    try {
      await categorizarTransacao(categorizandoId, categoriaEscolhida);
      setCategorizandoId(null);
      setCategoriaEscolhida("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao categorizar.");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--cor-texto)" }}>Conciliação Bancária</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--cor-texto-suave)" }}>
            {pendentes} transações pendentes · {sugestoes} sugestões de match aguardando aprovação
          </p>
        </div>
        <button
          onClick={rodarConciliacao}
          disabled={processando}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {processando ? "Processando…" : "Rodar conciliação automática"}
        </button>
      </header>

      {erro && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{erro}</div>}
      {aviso && <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</div>}

      <section className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <UploadZone titulo="Extrato bancário" descricao="Arraste aqui seu extrato (.OFX ou .PDF)" formatosAceitos=".ofx,.pdf" formatosLegiveis="OFX ou PDF" carregando={carregandoExtrato} onArquivos={enviarExtratos} />
        <UploadZone titulo="Comprovantes e notas" descricao="Arraste aqui recibos, notas ou boletos (.PDF, .PNG, .JPG)" formatosAceitos=".pdf,.png,.jpg,.jpeg" formatosLegiveis="PDF, PNG ou JPG" carregando={carregandoComprovante} onArquivos={enviarComprovantes} />
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--cor-texto-suave)" }}>Transações do extrato</h2>
          <div className="border" style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}>
            {transacoes.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--cor-texto-suave)" }}>
                Nenhuma transação importada ainda. Envie um extrato acima para começar.
              </p>
            ) : (
              transacoes.map((t) => (
                <TransacaoItem key={t.id} transacao={t} onAprovarConciliacao={aprovar} onCategorizarManualmente={(id) => setCategorizandoId(id)} />
              ))
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold" style={{ color: "var(--cor-texto-suave)" }}>Comprovantes lidos</h2>
          <div className="border" style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}>
            {documentos.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--cor-texto-suave)" }}>Nenhum comprovante enviado ainda.</p>
            ) : (
              documentos.map((d) => <ComprovanteItem key={d.id} comprovante={documentoParaCard(d)} />)
            )}
          </div>
        </div>
      </section>

      {categorizandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">Categorizar transação</h3>
            <select value={categoriaEscolhida} onChange={(e) => setCategoriaEscolhida(e.target.value)} className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Escolha uma categoria…</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome_categoria}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setCategorizandoId(null); setCategoriaEscolhida(""); }} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarCategoria} disabled={!categoriaEscolhida} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
