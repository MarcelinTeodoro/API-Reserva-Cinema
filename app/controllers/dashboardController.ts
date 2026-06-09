import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FastifyReply, FastifyRequest } from "fastify";
import { sendError } from "../lib/httpError";
import { listarLogsConsole } from "../lib/dashboardConsole";

const PUBLIC_DIR = join(process.cwd(), "app", "public");

async function enviarArquivo(
  reply: FastifyReply,
  nomeArquivo: string,
  contentType: string
) {
  try {
    const conteudo = await readFile(join(PUBLIC_DIR, nomeArquivo), "utf8");
    return reply.type(contentType).send(conteudo);
  } catch (err) {
    console.error(`[dashboard] Falha ao carregar ${nomeArquivo}.`, err);
    return sendError(reply, 500, "Nao foi possivel carregar o dashboard.");
  }
}

export async function mostrarDashboard(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return enviarArquivo(reply, "index.html", "text/html; charset=utf-8");
}

export async function entregarDashboardCss(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return enviarArquivo(reply, "styles.css", "text/css; charset=utf-8");
}

export async function entregarDashboardJs(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return enviarArquivo(reply, "app.js", "application/javascript; charset=utf-8");
}

function parseIntComFallback(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

export async function listarLogsDashboard(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = (request.query as Record<string, unknown>) ?? {};
  const since = parseIntComFallback(query.since, 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = parseIntComFallback(query.limit, 120, 1, 250);

  return reply.send(listarLogsConsole({ sinceId: since, limit }));
}
