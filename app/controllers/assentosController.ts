import { FastifyReply, FastifyRequest } from "fastify";
import { sessionParamsSchema } from "../validators/reservaValidator";
import { listarAssentosDisponiveis } from "../models/assentoModel";
import { criarFlowId, registrarFlowEvent } from "../lib/flowEvents";

export async function listarAssentos(
  request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[assentos] Requisicao recebida para listar assentos.");
  const { sessionId } = sessionParamsSchema.parse(request.params);
  const flowId = criarFlowId("assentos");
  registrarFlowEvent({
    flowId,
    level: "INFO",
    from: "Group A",
    to: "Group B",
    message: "consulta de assentos disponiveis recebida",
    sessionId,
  });

  console.log(`[assentos] Buscando assentos disponiveis da sessao ${sessionId}.`);
  const assentos = await listarAssentosDisponiveis(sessionId);
  registrarFlowEvent({
    flowId,
    level: "SUCCESS",
    from: "Group B",
    to: "Group A",
    message: `${assentos.length} assentos disponiveis retornados`,
    sessionId,
  });

  console.log(`[assentos] Respondendo com ${assentos.length} assentos livres.`);
  return reply.send({ sessionId, assentos });
}
