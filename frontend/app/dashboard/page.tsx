const KPIS = [
  { label: "Saldo em contas", valor: "—", nota: "Conecte um extrato para calcular" },
  { label: "A receber (30 dias)", valor: "—", nota: "Sem lançamentos futuros ainda" },
  { label: "A pagar (30 dias)", valor: "—", nota: "Sem lançamentos futuros ainda" },
  { label: "Pendências de conciliação", valor: "0", nota: "Nenhuma transação importada" },
];

export default function PaginaDashboard() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--cor-texto)" }}>
          Visão Geral
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--cor-texto-suave)" }}>
          Resumo financeiro consolidado
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((kpi) => (
          <div
            key={kpi.label}
            className="border px-5 py-4"
            style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}
          >
            <p className="text-xs" style={{ color: "var(--cor-texto-suave)" }}>
              {kpi.label}
            </p>
            <p className="font-dado mt-2 text-2xl font-semibold" style={{ color: "var(--cor-texto)" }}>
              {kpi.valor}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--cor-texto-suave)" }}>
              {kpi.nota}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 border" style={{ borderColor: "var(--cor-linha)", background: "var(--cor-superficie)" }}>
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--cor-linha)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--cor-texto)" }}>
            Alertas
          </h2>
        </div>
        <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--cor-texto-suave)" }}>
          Nenhum alerta no momento. Alertas de vencimento, saldo baixo e
          documentos não conciliados vão aparecer aqui.
        </p>
      </section>
    </main>
  );
}
