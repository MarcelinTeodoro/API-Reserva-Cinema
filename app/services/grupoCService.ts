const TIMEOUT_MS = 300_000;

export class TimeoutError extends Error {
  constructor() {
    super("Tempo de espera excedido ao contatar o Grupo C.");
    this.name = "TimeoutError";
  }
}

export class GrupoCError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, payload: unknown) {
    super("Erro ao processar pagamento no Grupo C.");
    this.name = "GrupoCError";
    this.status = status;
    this.payload = payload;
  }
}

export async function encaminharParaGrupoC(body: unknown) {
  const url = process.env.GRUPO_C_URL;
  if (!url) throw new Error("GRUPO_C_URL não configurada.");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new TimeoutError();
    }
    throw err;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) throw new GrupoCError(response.status, payload);

  return payload;
}
