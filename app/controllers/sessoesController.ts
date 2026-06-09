import { FastifyReply, FastifyRequest } from "fastify";
import { sessionParamsSchema } from "../validators/reservaValidator";
import { buscarMapaSessao, listarResumoSessoes } from "../models/assentoModel";

export async function listarSessoes(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[sessoes] Requisicao recebida para resumo de sessoes.");
  const sessoes = await listarResumoSessoes();
  return reply.send({ sessoes });
}

export async function obterMapaSessao(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { sessionId } = sessionParamsSchema.parse(request.params);
  console.log(`[sessoes] Montando mapa de assentos da sessao ${sessionId}.`);
  const mapa = await buscarMapaSessao(sessionId);
  return reply.send(mapa);
}
