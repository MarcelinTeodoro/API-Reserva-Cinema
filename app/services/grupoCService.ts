export const GRUPO_C_TIMEOUT_MS = 15_000;
const AVISO_GRUPO_C_MS = 5_000;
const AVISOS_GRUPO_C = GRUPO_C_TIMEOUT_MS / AVISO_GRUPO_C_MS;

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
  if (!url) throw new Error("GRUPO_C_URL nao configurada.");

  const controller = new AbortController();
  const avisos = Array.from({ length: AVISOS_GRUPO_C }, (_, i) =>
    setTimeout(() => {
      const segundos = (i + 1) * 5;
      console.warn(
        `[grupo-c] Ainda esperando resposta do Grupo C depois de ${segundos}s. Nossa API segue rodando.`
      );
    }, (i + 1) * AVISO_GRUPO_C_MS)
  );
  const timeout = setTimeout(() => controller.abort(), GRUPO_C_TIMEOUT_MS);

  let response: Response;
  try {
    console.log("[grupo-c] Enviando reserva para o Grupo C.");
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    console.log(`[grupo-c] Grupo C respondeu com status ${response.status}.`);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new TimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    avisos.forEach(clearTimeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) throw new GrupoCError(response.status, payload);

  return payload;
}
