interface EmConstrucaoProps {
  titulo: string;
  descricao: string;
  itens: string[];
}

export function EmConstrucao({ titulo, descricao, itens }: EmConstrucaoProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--cor-texto)" }}>
          {titulo}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--cor-texto-suave)" }}>
          {descricao}
        </p>
      </header>

      <section
        className="border px-6 py-8"
        style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--cor-texto)" }}>
          Ainda não implementado. Esta seção vai cobrir:
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm" style={{ color: "var(--cor-texto-suave)" }}>
          {itens.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
