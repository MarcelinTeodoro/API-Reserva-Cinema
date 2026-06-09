import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { criarFlowId, registrarFlowEvent } from "../lib/flowEvents";

export async function limpezaSessoes(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[admin] Requisicao recebida para limpeza de sessoes.");
  const flowId = criarFlowId("limpeza");
  registrarFlowEvent({
    flowId,
    level: "INFO",
    from: "Group A",
    to: "Group B",
    message: "limpeza de sessoes encerradas solicitada",
  });

  const agora = new Date();

  console.log("[admin] Buscando sessoes encerradas.");
  const sessoes = await prisma.sessao.findMany({
    where: { dataHoraFim: { lt: agora } },
    include: {
      assentos: {
        select: { id: true },
      },
    },
  });

  const sessoesLimpas = sessoes.length;
  const assentosRemovidos = sessoes.reduce(
    (total, sessao) => total + sessao.assentos.length,
    0
  );

  if (sessoesLimpas > 0) {
    console.log(`[admin] Removendo ${sessoesLimpas} sessoes encerradas.`);
    await prisma.sessao.deleteMany({
      where: { id: { in: sessoes.map((sessao) => sessao.id) } },
    });
  }

  registrarFlowEvent({
    flowId,
    level: "SUCCESS",
    from: "Group B",
    to: "Database",
    message: `${sessoesLimpas} sessoes e ${assentosRemovidos} assentos removidos`,
  });

  console.log("[admin] Limpeza concluida. Respondendo requisicao.");
  return reply.send({
    mensagem: "Limpeza concluida",
    sessoesLimpas,
    assentosRemovidos,
    assentosOcupadosRemovidos: assentosRemovidos,
  });
}
