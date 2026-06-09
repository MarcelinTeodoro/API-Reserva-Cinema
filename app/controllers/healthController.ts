import { FastifyReply, FastifyRequest } from "fastify";

export async function healthCheck(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({
    status: "ok",
    service: "api-reserva-cinema",
    timestamp: new Date().toISOString(),
  });
}
