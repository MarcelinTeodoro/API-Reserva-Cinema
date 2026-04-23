import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { STATUS } from "../lib/assentos";

export async function limpezaSessoes(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const agora = new Date();

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
    (total, s) => total + s.assentos.length,
    0
  );

  if (sessoesLimpas > 0) {
    await prisma.sessao.deleteMany({
      where: { id: { in: sessoes.map((s) => s.id) } },
    });
  }

  return reply.send({
    mensagem: "Limpeza concluída",
    sessoesLimpas,
    assentosOcupadosRemovidos,
  });
}
