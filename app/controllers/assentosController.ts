import { FastifyReply, FastifyRequest } from "fastify";
import { sessionParamsSchema } from "../validators/reservaValidator";
import { listarAssentosDisponiveis } from "../models/assentoModel";

export async function listarAssentos(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { sessionId } = sessionParamsSchema.parse(request.params);
  const assentos = await listarAssentosDisponiveis(sessionId);
  return reply.send({ sessionId, assentos });
}
