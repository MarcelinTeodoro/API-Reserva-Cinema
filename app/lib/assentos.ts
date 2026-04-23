export const FILEIRAS = ["A", "B", "C", "D", "E"] as const;
export const COLUNAS = Array.from({ length: 10 }, (_, i) => i + 1);

export const TODOS_ASSENTOS: string[] = FILEIRAS.flatMap((f) =>
  COLUNAS.map((c) => `${f}${c}`)
);

export const STATUS = {
  DISPONIVEL: "DISPONIVEL",
  PENDENTE: "PENDENTE",
  OCUPADO: "OCUPADO",
} as const;

export type StatusAssento = (typeof STATUS)[keyof typeof STATUS];
