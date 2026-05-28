import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { STATUS } from "../lib/assentos";

export async function limpezaSessoes(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  console.log("[admin] Requisicao recebida para limpeza de sessoes.");

  const agora = new Date();

  console.log("[admin] Buscando sessoes encerradas.");
  const sessoes = await prisma.sessao.findMany({
    where: { dataHoraFim: { lt: agora } },
    include: {
      assentos: {
        where: { status: STATUS.OCUPADO },
        select: { id: true },
      },
    },
  });

  const sessoesLimpas = sessoes.length;
  const assentosOcupadosRemovidos = sessoes.reduce(
    (total, sessao) => total + sessao.assentos.length,
    0
  );

  if (sessoesLimpas > 0) {
    console.log(`[admin] Removendo ${sessoesLimpas} sessoes encerradas.`);
    await prisma.sessao.deleteMany({
      where: { id: { in: sessoes.map((sessao) => sessao.id) } },
    });
  }

  console.log("[admin] Limpeza concluida. Respondendo requisicao.");
  return reply.send({
    mensagem: "Limpeza concluida",
    sessoesLimpas,
    assentosOcupadosRemovidos,
  });
}
