"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  titulo: string;
  descricao: string;
  formatosAceitos: string; // ex: ".ofx,.pdf" — usado no <input accept>
  formatosLegiveis: string; // ex: "OFX ou PDF" — exibido para o usuário
  carregando?: boolean;
  onArquivos: (arquivos: File[]) => void;
}

export function UploadZone({
  titulo,
  descricao,
  formatosAceitos,
  formatosLegiveis,
  carregando = false,
  onArquivos,
}: UploadZoneProps) {
  const [arrastando, setArrastando] = useState(false);
  const [erroFormato, setErroFormato] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extensoesValidas = formatosAceitos.split(",").map((e) => e.trim().toLowerCase());

  const validarEEnviar = useCallback(
    (lista: FileList | null) => {
      if (!lista || lista.length === 0) return;
      const arquivos = Array.from(lista);

      const invalidos = arquivos.filter((a) => {
        const ext = "." + a.name.split(".").pop()?.toLowerCase();
        return !extensoesValidas.includes(ext);
      });

      if (invalidos.length > 0) {
        setErroFormato(
          `Formato não suportado: ${invalidos.map((a) => a.name).join(", ")}. Aceitos: ${formatosLegiveis}.`
        );
        return;
      }

      setErroFormato(null);
      onArquivos(arquivos);
    },
    [extensoesValidas, formatosLegiveis, onArquivos]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        validarEEnviar(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className="group relative flex min-h-[132px] cursor-pointer flex-col items-center justify-center gap-1 border px-6 py-8 text-center transition-colors"
      style={{
        borderColor: arrastando ? "var(--cor-acento)" : "var(--cor-linha)",
        background: arrastando ? "var(--cor-acento-suave)" : "var(--cor-superficie)",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={formatosAceitos}
        className="hidden"
        onChange={(e) => validarEEnviar(e.target.files)}
      />

      <p className="text-[15px] font-semibold" style={{ color: "var(--cor-texto)" }}>
        {titulo}
      </p>
      <p className="text-sm" style={{ color: "var(--cor-texto-suave)" }}>
        {descricao}
      </p>

      {carregando && (
        <div
          className="mt-2 flex items-center gap-2 text-xs"
          style={{ color: "var(--cor-acento)" }}
        >
          <span
            className="h-3 w-3 animate-spin border-2 border-current"
            style={{ borderRightColor: "transparent", borderRadius: "50%" }}
          />
          Processando arquivo…
        </div>
      )}

      {erroFormato && (
        <p className="mt-2 text-xs" style={{ color: "var(--cor-erro)" }}>
          {erroFormato}
        </p>
      )}
    </div>
  );
}
