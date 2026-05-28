import { FastifyReply, FastifyRequest } from "fastify";
import { sessionParamsSchema } from "../validators/reservaValidator";
import { listarAssentosDisponiveis } from "../models/assentoModel";

export async function listarAssentos(
  request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[assentos] Requisicao recebida para listar assentos.");
  const { sessionId } = sessionParamsSchema.parse(request.params);
  console.log(`[assentos] Buscando assentos disponiveis da sessao ${sessionId}.`);
  const assentos = await listarAssentosDisponiveis(sessionId);
  console.log(`[assentos] Respondendo com ${assentos.length} assentos livres.`);
  return reply.send({ sessionId, assentos });
}
