import Fastify from "fastify";
import { ZodError } from "zod";
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
      return reply.status(400).send({
        codigo: "VALIDACAO_INVALIDA",
        mensagem: "Dados inválidos.",
        detalhes: error.issues,
      });
    }
    app.log.error(error);
    return reply.status(500).send({
      codigo: "ERRO_INTERNO",
      mensagem: "Erro interno do servidor.",
    });
  });

  registerRoutes(app);
  return app;
}
