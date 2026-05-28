import Fastify from "fastify";
import { ZodError } from "zod";
import { sendError } from "./lib/httpError";
import { registerRoutes } from "./routes";

export function buildServer() {
  const app = Fastify({
    logger: true,
    connectionTimeout: 310_000,
    keepAliveTimeout: 310_000,
    requestTimeout: 310_000,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return sendError(reply, 400, "Dados invalidos.", error.issues);
    }

    app.log.error(error);
    return sendError(reply, 500, "Erro interno do servidor.");
  });

  registerRoutes(app);
  return app;
}
