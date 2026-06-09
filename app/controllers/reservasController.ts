import { FastifyReply, FastifyRequest } from "fastify";
import {
  reservaBodySchema,
  sessionParamsSchema,
} from "../validators/reservaValidator";
import {
  AssentosIndisponiveisError,
  atualizarStatusAssentos,
  buscarOuCriarSessao,
  buscarAssentosIndisponiveis,
  marcarAssentosPendentes,
  reverterParaDisponivel,
} from "../models/assentoModel";
import { sendError } from "../lib/httpError";
import { STATUS } from "../lib/assentos";
import {
  GrupoCError,
  TimeoutError,
  encaminharParaGrupoC,
} from "../services/grupoCService";
import { criarFlowId, registrarFlowEvent } from "../lib/flowEvents";

function obterDemoPendingDelayMs() {
  const valor = Number(process.env.DEMO_PENDING_DELAY_MS ?? 0);
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  return Math.floor(valor);
}

function aguardar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function criarReserva(
  request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[reserva] Requisicao de reserva recebida.");

  const { sessionId } = sessionParamsSchema.parse(request.params);
  const body = reservaBodySchema.parse(request.body);
  const flowId = criarFlowId("reserva");
  registrarFlowEvent({
    flowId,
    level: "INFO",
    from: "Group A",
    to: "Group B",
    message: "reserva recebida",
    sessionId,
    assentos: body.assentos,
  });

  console.log(
    `[reserva] Assentos validados para sessao ${sessionId}: ${body.assentos.join(
      ", "
    )}.`
  );
  registrarFlowEvent({
    flowId,
    level: "SUCCESS",
    from: "Group B",
    to: "Group B",
    message: "assentos e sessao validados",
    sessionId,
    assentos: body.assentos,
  });

  console.log(`[reserva] Verificando sessao ${sessionId} no banco.`);
  const sessao = await buscarOuCriarSessao(sessionId, body.dataHoraFim);

  if (sessao.dataHoraFim.getTime() !== body.dataHoraFim.getTime()) {
    console.warn(
      `[reserva] dataHoraFim divergente para sessao existente ${sessionId}.`
    );
    registrarFlowEvent({
      flowId,
      level: "ERROR",
      from: "Group B",
      to: "Group A",
      message: "dataHoraFim divergente da sessao cadastrada",
      sessionId,
      assentos: body.assentos,
    });
    return sendError(
      reply,
      400,
      "dataHoraFim diferente da sessao ja cadastrada."
    );
  }

  if (sessao.dataHoraFim.getTime() < Date.now()) {
    console.warn(`[reserva] Sessao ${sessionId} ja terminou.`);
    registrarFlowEvent({
      flowId,
      level: "ERROR",
      from: "Group B",
      to: "Group A",
      message: "sessao encerrada",
      sessionId,
      assentos: body.assentos,
    });
    return sendError(reply, 400, "A sessao ja foi encerrada.");
  }

  console.log("[reserva] Conferindo se os assentos estao disponiveis.");
  const indisponiveis = await buscarAssentosIndisponiveis(
    sessionId,
    body.assentos
  );
  if (indisponiveis.length > 0) {
    console.warn(
      `[reserva] Assentos indisponiveis: ${indisponiveis.join(", ")}.`
    );
    registrarFlowEvent({
      flowId,
      level: "WARN",
      from: "Database",
      to: "Group B",
      message: `assentos indisponiveis: ${indisponiveis.join(", ")}`,
      sessionId,
      assentos: body.assentos,
    });
    return sendError(reply, 409, "Assentos indisponiveis.", {
      assentos: indisponiveis,
    });
  }

  try {
    console.log("[reserva] Marcando assentos como PENDENTE.");
    await marcarAssentosPendentes(sessionId, body.assentos);
    registrarFlowEvent({
      flowId,
      level: "INFO",
      from: "Group B",
      to: "Database",
      message: "assentos marcados como PENDENTE",
      sessionId,
      assentos: body.assentos,
    });

    console.log("[reserva] Enviando reserva para o Grupo C.");
    const resposta = await encaminharParaGrupoC(request.body, {
      flowId,
      sessionId,
      assentos: body.assentos,
    });

    const demoDelayMs = obterDemoPendingDelayMs();
    if (demoDelayMs > 0) {
      console.log(
        `[reserva] Demo ativo: mantendo PENDENTE por ${demoDelayMs}ms.`
      );
      await aguardar(demoDelayMs);
    }

    console.log("[reserva] Grupo C aprovou. Confirmando assentos como OCUPADO.");
    await atualizarStatusAssentos(sessionId, body.assentos, STATUS.OCUPADO);
    registrarFlowEvent({
      flowId,
      level: "SUCCESS",
      from: "Group B",
      to: "Database",
      message: "assentos confirmados como OCUPADO",
      sessionId,
      assentos: body.assentos,
    });

    console.log("[reserva] Reserva finalizada com sucesso. Respondendo 200.");
    registrarFlowEvent({
      flowId,
      level: "SUCCESS",
      from: "Group B",
      to: "Group A",
      message: "reserva confirmada",
      sessionId,
      assentos: body.assentos,
    });
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
      registrarFlowEvent({
        flowId,
        level: "WARN",
        from: "Database",
        to: "Group B",
        message: `assentos indisponiveis: ${err.assentos.join(", ")}`,
        sessionId,
        assentos: body.assentos,
      });
      return sendError(reply, 409, "Assentos indisponiveis.", {
        assentos: err.assentos,
      });
    }

    console.warn("[reserva] Falha apos bloqueio. Liberando assentos PENDENTE.");
    await reverterParaDisponivel(sessionId, body.assentos);
    registrarFlowEvent({
      flowId,
      level: "WARN",
      from: "Group B",
      to: "Database",
      message: "assentos PENDENTE liberados",
      sessionId,
      assentos: body.assentos,
    });

    if (err instanceof TimeoutError) {
      console.warn("[reserva] Grupo C nao respondeu a tempo.");
      registrarFlowEvent({
        flowId,
        level: "ERROR",
        from: "Group B",
        to: "Group A",
        message: "reserva falhou por timeout do Grupo C",
        sessionId,
        assentos: body.assentos,
      });
      return sendError(reply, 504, err.message);
    }

    if (err instanceof GrupoCError) {
      console.warn(`[reserva] Grupo C recusou com status ${err.status}.`);
      registrarFlowEvent({
        flowId,
        level: "ERROR",
        from: "Group B",
        to: "Group A",
        message: `reserva recusada pelo Grupo C com status ${err.status}`,
        sessionId,
        assentos: body.assentos,
      });
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
