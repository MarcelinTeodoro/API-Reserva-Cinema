import Fastify from "fastify";
import { ZodError } from "zod";
import { sendError } from "./lib/httpError";
import { registrarLogConsole } from "./lib/dashboardConsole";
import { registerRoutes } from "./routes";

const ROTAS_IGNORADAS_CONSOLE = [
  "/dashboard/logs",
  "/dashboard.css",
  "/dashboard.js",
];

function deveIgnorarNoConsole(url: string) {
  return ROTAS_IGNORADAS_CONSOLE.some((rota) => url.startsWith(rota));
}

function resumirBody(body: unknown) {
  if (body === undefined || body === null) return null;

  let texto = "";
  if (typeof body === "string") {
    texto = body;
  } else {
    try {
      texto = JSON.stringify(body);
    } catch (_err) {
      texto = "[body nao serializavel]";
    }
  }

  const LIMITE = 320;
  return texto.length > LIMITE ? `${texto.slice(0, LIMITE)} ...` : texto;
}

export function buildServer() {
  const app = Fastify({
    logger: true,
    connectionTimeout: 310_000,
    keepAliveTimeout: 310_000,
    requestTimeout: 310_000,
  });

  app.addHook("onRequest", (request, _reply, done) => {
    if (!deveIgnorarNoConsole(request.url)) {
      registrarLogConsole("INFO", "HTTP", `>> ${request.method} ${request.url}`);
    }
    done();
  });

  app.addHook("preValidation", (request, _reply, done) => {
    if (!deveIgnorarNoConsole(request.url)) {
      const method = request.method.toUpperCase();
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        const body = resumirBody((request as { body?: unknown }).body);
        if (body) {
          registrarLogConsole(
            "INFO",
            "PAYLOAD",
            `${method} ${request.url} body: ${body}`
          );
        }
      }
    }
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    if (!deveIgnorarNoConsole(request.url)) {
      const elapsedMs = Math.round(reply.elapsedTime);
      const status = reply.statusCode;
      const level =
        status >= 500
          ? "ERROR"
          : status >= 400
            ? "WARN"
            : "SUCCESS";

      registrarLogConsole(
        level,
        "HTTP",
        `<< ${request.method} ${request.url} ${status} (${elapsedMs}ms)`
      );
    }
    done();
  });

  app.addHook("onError", (request, _reply, error, done) => {
    if (!deveIgnorarNoConsole(request.url)) {
      registrarLogConsole(
        "ERROR",
        "APP",
        `${request.method} ${request.url} falhou: ${error.message}`
      );
    }
    done();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      registrarLogConsole("WARN", "VALIDACAO", "Dados invalidos na requisicao.");
      return sendError(reply, 400, "Dados invalidos.", error.issues);
    }

    app.log.error(error);
    registrarLogConsole("ERROR", "APP", "Erro interno do servidor.");
    return sendError(reply, 500, "Erro interno do servidor.");
  });

  registerRoutes(app);
  return app;
}
