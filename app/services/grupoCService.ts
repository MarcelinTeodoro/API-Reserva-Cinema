import { registrarFlowEvent } from "../lib/flowEvents";

export const GRUPO_C_TIMEOUT_MS = 15_000;
const AVISO_GRUPO_C_MS = 5_000;
const AVISOS_GRUPO_C = GRUPO_C_TIMEOUT_MS / AVISO_GRUPO_C_MS;

type GrupoCFlowContext = {
  flowId: string;
  sessionId: string;
  assentos: string[];
};

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

export async function encaminharParaGrupoC(
  body: unknown,
  flow?: GrupoCFlowContext
) {
  const url = process.env.GRUPO_C_URL;
  if (!url) throw new Error("GRUPO_C_URL nao configurada.");

  const controller = new AbortController();
  const avisos = Array.from({ length: AVISOS_GRUPO_C }, (_, i) =>
    setTimeout(() => {
      const segundos = (i + 1) * 5;
      console.warn(
        `[grupo-c] Aguardando resposta do Grupo C ha ${segundos}s.`
      );
    }, (i + 1) * AVISO_GRUPO_C_MS)
  );
  const timeout = setTimeout(() => controller.abort(), GRUPO_C_TIMEOUT_MS);

  let response: Response;
  try {
    console.log("[grupo-c] Requisicao enviada ao Grupo C.");
    if (flow) {
      registrarFlowEvent({
        flowId: flow.flowId,
        level: "INFO",
        from: "Group B",
        to: "Group C",
        message: "validacao de pagamento/reserva enviada",
        sessionId: flow.sessionId,
        assentos: flow.assentos,
      });
    }
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    console.log(`[grupo-c] Resposta recebida com status ${response.status}.`);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      if (flow) {
        registrarFlowEvent({
          flowId: flow.flowId,
          level: "ERROR",
          from: "Group C",
          to: "Group B",
          message: "timeout ao aguardar resposta",
          sessionId: flow.sessionId,
          assentos: flow.assentos,
        });
      }
      throw new TimeoutError();
    }
    if (flow) {
      registrarFlowEvent({
        flowId: flow.flowId,
        level: "ERROR",
        from: "Group C",
        to: "Group B",
        message: "falha ao contatar Grupo C",
        sessionId: flow.sessionId,
        assentos: flow.assentos,
      });
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

  if (!response.ok) {
    if (flow) {
      registrarFlowEvent({
        flowId: flow.flowId,
        level: "ERROR",
        from: "Group C",
        to: "Group B",
        message: `resposta recusada com status ${response.status}`,
        sessionId: flow.sessionId,
        assentos: flow.assentos,
      });
    }
    throw new GrupoCError(response.status, payload);
  }

  if (flow) {
    registrarFlowEvent({
      flowId: flow.flowId,
      level: "SUCCESS",
      from: "Group C",
      to: "Group B",
      message: `resposta aprovada com status ${response.status}`,
      sessionId: flow.sessionId,
      assentos: flow.assentos,
    });
  }

  return payload;
}
