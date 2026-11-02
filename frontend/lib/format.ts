export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("pt-BR") : "—";

export const mesBR = (ym: string) => {
  const [a, m] = ym.split("-");
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
};
