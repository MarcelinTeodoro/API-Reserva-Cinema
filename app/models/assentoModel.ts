import { Prisma } from "../generated/prisma";
import { prisma } from "../lib/prisma";
import { STATUS, TODOS_ASSENTOS, StatusAssento } from "../lib/assentos";

export class AssentosIndisponiveisError extends Error {
  assentos: string[];

  constructor(assentos: string[]) {
    super("Assentos indisponiveis.");
    this.name = "AssentosIndisponiveisError";
    this.assentos = assentos;
  }
}

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

type ResumoAssentos = {
  disponiveis: number;
  pendentes: number;
  ocupados: number;
  capacidadeTotal: number;
  taxaOcupacao: number;
};

export type SessaoResumo = {
  sessionId: string;
  dataHoraFim: Date;
  encerrada: boolean;
  resumo: ResumoAssentos;
};

export type MapaAssento = {
  numero: string;
  status: StatusAssento;
};

export type SessaoMapa = {
  sessionId: string;
  existe: boolean;
  dataHoraFim: Date | null;
  encerrada: boolean;
  resumo: ResumoAssentos;
  assentos: MapaAssento[];
};

function calcularResumo(statuses: StatusAssento[]): ResumoAssentos {
  let pendentes = 0;
  let ocupados = 0;

  for (const status of statuses) {
    if (status === STATUS.PENDENTE) pendentes += 1;
    if (status === STATUS.OCUPADO) ocupados += 1;
  }

  const capacidadeTotal = TODOS_ASSENTOS.length;
  const disponiveis = capacidadeTotal - pendentes - ocupados;
  const taxaOcupacao = Number(((ocupados / capacidadeTotal) * 100).toFixed(1));

  return {
    disponiveis,
    pendentes,
    ocupados,
    capacidadeTotal,
    taxaOcupacao,
  };
}

export async function listarResumoSessoes(): Promise<SessaoResumo[]> {
  const agora = Date.now();
  const sessoes = await prisma.sessao.findMany({
    include: {
      assentos: {
        where: { status: { in: [STATUS.PENDENTE, STATUS.OCUPADO] } },
        select: { status: true },
      },
    },
    orderBy: { dataHoraFim: "asc" },
  });

  return sessoes.map((sessao) => {
    const statuses = sessao.assentos.map(
      (assento) => assento.status as StatusAssento
    );
    return {
      sessionId: sessao.id,
      dataHoraFim: sessao.dataHoraFim,
      encerrada: sessao.dataHoraFim.getTime() < agora,
      resumo: calcularResumo(statuses),
    };
  });
}

export async function buscarMapaSessao(sessionId: string): Promise<SessaoMapa> {
  const sessao = await prisma.sessao.findUnique({
    where: { id: sessionId },
    include: {
      assentos: {
        where: { status: { in: [STATUS.PENDENTE, STATUS.OCUPADO] } },
        select: { numero: true, status: true },
      },
    },
  });

  const statusMap = new Map<string, StatusAssento>(
    TODOS_ASSENTOS.map((numero) => [numero, STATUS.DISPONIVEL])
  );

  if (sessao) {
    for (const assento of sessao.assentos) {
      statusMap.set(assento.numero, assento.status as StatusAssento);
    }
  }

  const assentos = TODOS_ASSENTOS.map((numero) => ({
    numero,
    status: statusMap.get(numero) ?? STATUS.DISPONIVEL,
  }));

  const resumo = calcularResumo(assentos.map((assento) => assento.status));

  return {
    sessionId,
    existe: Boolean(sessao),
    dataHoraFim: sessao?.dataHoraFim ?? null,
    encerrada: sessao ? sessao.dataHoraFim.getTime() < Date.now() : false,
    resumo,
    assentos,
  };
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
  try {
    await prisma.$transaction(
      numeros.map((numero) =>
        prisma.assento.create({
          data: { sessaoId: sessionId, numero, status: STATUS.PENDENTE },
        })
      )
    );
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        const indisponiveis = await buscarAssentosIndisponiveis(
          sessionId,
          numeros
        );
        throw new AssentosIndisponiveisError(indisponiveis);
      }
    }
    throw err;
  }
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
