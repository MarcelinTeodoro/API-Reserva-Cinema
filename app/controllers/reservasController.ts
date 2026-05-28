import { FastifyReply, FastifyRequest } from "fastify";
import {
  reservaBodySchema,
  sessionParamsSchema,
} from "../validators/reservaValidator";
import {
  AssentosIndisponiveisError,
  atualizarStatusAssentos,
  buscarAssentosIndisponiveis,
  marcarAssentosPendentes,
  reverterParaDisponivel,
  upsertSessao,
} from "../models/assentoModel";
import { sendError } from "../lib/httpError";
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
  console.log("[reserva] Requisicao recebida para criar reserva.");

  const { sessionId } = sessionParamsSchema.parse(request.params);
  const body = reservaBodySchema.parse(request.body);
  console.log(
    `[reserva] Dados validados para sessao ${sessionId}: ${body.assentos.join(
      ", "
    )}.`
  );

  if (body.dataHoraFim.getTime() < Date.now()) {
    console.warn(`[reserva] Sessao ${sessionId} ja terminou.`);
    console.log("[reserva] Respondendo com erro 400.");
    return sendError(reply, 400, "A sessao ja foi encerrada.");
  }

  console.log(`[reserva] Garantindo sessao ${sessionId} no banco.`);
  await upsertSessao(sessionId, body.dataHoraFim);

  console.log("[reserva] Conferindo se os assentos estao disponiveis.");
  const indisponiveis = await buscarAssentosIndisponiveis(
    sessionId,
    body.assentos
  );
  if (indisponiveis.length > 0) {
    console.warn(
      `[reserva] Assentos indisponiveis: ${indisponiveis.join(", ")}.`
    );
    console.log("[reserva] Respondendo com erro 409.");
    return sendError(reply, 409, "Assentos indisponiveis.", {
      assentos: indisponiveis,
    });
  }

  try {
    console.log("[reserva] Marcando assentos como pendentes.");
    await marcarAssentosPendentes(sessionId, body.assentos);

    console.log("[reserva] Assentos bloqueados. Chamando o Grupo C agora.");
    const resposta = await encaminharParaGrupoC(request.body);

    console.log("[reserva] Pagamento aprovado. Confirmando assentos.");
    await atualizarStatusAssentos(sessionId, body.assentos, STATUS.OCUPADO);

    console.log("[reserva] Reserva finalizada com sucesso. Respondendo 200.");
    return reply.status(200).send({
      sessionId,
      assentos: body.assentos,
      status: STATUS.OCUPADO,
      grupoC: resposta,
    });
  } catch (err) {
    if (err instanceof AssentosIndisponiveisError) {
      console.warn(
        `[reserva] Outro pedido pegou o assento antes: ${err.assentos.join(
          ", "
        )}.`
      );
      console.log("[reserva] Respondendo com erro 409.");
      return sendError(reply, 409, "Assentos indisponiveis.", {
        assentos: err.assentos,
      });
    }

    console.warn("[reserva] Algo falhou depois do bloqueio. Liberando assentos.");
    await reverterParaDisponivel(sessionId, body.assentos);

    if (err instanceof TimeoutError) {
      console.warn("[reserva] Grupo C nao respondeu a tempo.");
      console.log("[reserva] Respondendo com erro 504.");
      return sendError(reply, 504, err.message);
    }

    if (err instanceof GrupoCError) {
      console.warn(`[reserva] Grupo C recusou com status ${err.status}.`);
      console.log(`[reserva] Respondendo com erro ${err.status}.`);
      return sendError(
        reply,
        err.status,
        "Grupo C retornou erro ao processar a reserva.",
        err.payload
      );
    }

    console.error("[reserva] Erro inesperado no fluxo de reserva.");
    throw err;
  }
}
