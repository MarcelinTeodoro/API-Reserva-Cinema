import { prisma } from "../lib/prisma";
import { STATUS, TODOS_ASSENTOS } from "../lib/assentos";

export async function listarAssentosDisponiveis(sessionId: string) {
  const sessao = await prisma.sessao.findUnique({
    where: { id: sessionId },
    include: { assentos: true },
  });

  if (!sessao) return TODOS_ASSENTOS;

  const indisponiveis = new Set(
    sessao.assentos
      .filter((a) => a.status === STATUS.OCUPADO || a.status === STATUS.PENDENTE)
      .map((a) => a.numero)
  );

  return TODOS_ASSENTOS.filter((n) => !indisponiveis.has(n));
}

export async function buscarAssentosIndisponiveis(
  sessionId: string,
  numeros: string[]
) {
  const encontrados = await prisma.assento.findMany({
    where: {
      sessaoId: sessionId,
      numero: { in: numeros },
      status: { in: [STATUS.PENDENTE, STATUS.OCUPADO] },
    },
    select: { numero: true },
  });
  return encontrados.map((a) => a.numero);
}

export async function upsertSessao(sessionId: string, dataHoraFim: Date) {
  return prisma.sessao.upsert({
    where: { id: sessionId },
    update: { dataHoraFim },
    create: { id: sessionId, dataHoraFim },
  });
}

export async function marcarAssentosPendentes(
  sessionId: string,
  numeros: string[]
) {
  await prisma.$transaction(
    numeros.map((numero) =>
      prisma.assento.upsert({
        where: { sessaoId_numero: { sessaoId: sessionId, numero } },
        update: { status: STATUS.PENDENTE },
        create: { sessaoId: sessionId, numero, status: STATUS.PENDENTE },
      })
    )
  );
}

export async function atualizarStatusAssentos(
  sessionId: string,
  numeros: string[],
  status: string
) {
  await prisma.assento.updateMany({
    where: { sessaoId: sessionId, numero: { in: numeros } },
    data: { status },
  });
}

export async function reverterParaDisponivel(
  sessionId: string,
  numeros: string[]
) {
  await prisma.assento.deleteMany({
    where: {
      sessaoId: sessionId,
      numero: { in: numeros },
      status: STATUS.PENDENTE,
    },
  });
}
