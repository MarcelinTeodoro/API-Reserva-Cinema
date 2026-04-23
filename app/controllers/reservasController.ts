import { FastifyReply, FastifyRequest } from "fastify";
import {
  reservaBodySchema,
  sessionParamsSchema,
} from "../validators/reservaValidator";
import {
  atualizarStatusAssentos,
  buscarAssentosIndisponiveis,
  marcarAssentosPendentes,
  reverterParaDisponivel,
  upsertSessao,
} from "../models/assentoModel";
import { STATUS } from "../lib/assentos";
import {
  GrupoCError,
  TimeoutError,
  encaminharParaGrupoC,
} from "../services/grupoCService";

export async function criarReserva(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { sessionId } = sessionParamsSchema.parse(request.params);
  const body = reservaBodySchema.parse(request.body);

  if (body.dataHoraFim.getTime() < Date.now()) {
    return reply.status(400).send({
      codigo: "SESSAO_EXPIRADA",
      mensagem: "A sessão já foi encerrada.",
    });
  }

  await upsertSessao(sessionId, body.dataHoraFim);

  const indisponiveis = await buscarAssentosIndisponiveis(
    sessionId,
    body.assentos
  );
  if (indisponiveis.length > 0) {
    return reply.status(409).send({
      codigo: "ASSENTOS_INDISPONIVEIS",
      mensagem: "Assentos indisponíveis",
      assentos: indisponiveis,
    });
  }

  await marcarAssentosPendentes(sessionId, body.assentos);

  try {
    const resposta = await encaminharParaGrupoC(request.body);
    await atualizarStatusAssentos(sessionId, body.assentos, STATUS.OCUPADO);
    return reply.status(200).send({
      sessionId,
      assentos: body.assentos,
      status: STATUS.OCUPADO,
      grupoC: resposta,
    });
  } catch (err) {
    await reverterParaDisponivel(sessionId, body.assentos);

    if (err instanceof TimeoutError) {
      return reply.status(504).send({
        codigo: "TIMEOUT_GRUPO_C",
        mensagem: err.message,
      });
    }
    if (err instanceof GrupoCError) {
      return reply.status(err.status).send(err.payload);
    }
    throw err;
  }
}
