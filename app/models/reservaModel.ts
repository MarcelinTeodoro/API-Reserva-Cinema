import { PrismaClient, Prisma } from '../generated/prisma';
import { enviarParaPagamento, DadosPagamento } from './grupoC';

const prisma = new PrismaClient({});

export interface CriarReservaInput {
  id_usuario: string;
  id_filme: string;
  id_sala: string;
  horario: string;
  assento_solicitado: string;
}

export interface ReservaResponse {
  id_reserva: string;
  id_usuario: string;
  id_filme: string;
  id_sala: string;
  horario: string;
  assento_reservado: string;
  criado_em: string;
  expira_em: string;
}

// Verificar se assento está disponível e bloquear
export async function criarReservaTemporaria(input: CriarReservaInput): Promise<{ sucesso: boolean; erroMsg?: string; reserva?: any }> {
  try {
    // Buscar assento ou criar se não existir
    let assento = await prisma.assento.findUnique({
      where: {
        salaId_numero: {
          salaId: input.id_sala,
          numero: input.assento_solicitado,
        },
      },
    });

    if (!assento) {
      assento = await prisma.assento.create({
        data: {
          salaId: input.id_sala,
          numero: input.assento_solicitado,
          status: 'BLOQUEADO',
          bloqueadoEm: new Date(),
          expiradoEm: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
        },
      });
    }

    // Se assento não está LIVRE, não pode bloquear
    if (assento.status !== 'LIVRE') {
      return { sucesso: false, erroMsg: 'Assento indisponível' };
    }

    // Criar reserva
    const expiradoEm = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    const reserva = await prisma.reserva.create({
      data: {
        usuarioId: input.id_usuario,
        filmeId: input.id_filme,
        salaId: input.id_sala,
        horario: new Date(input.horario),
        status: 'PENDENTE',
        assentoId: assento.id,
        expiradoEm,
      },
      include: { assento: true },
    });

    // Atualizar assento para BLOQUEADO
    await prisma.assento.update({
      where: { id: assento.id },
      data: {
        status: 'BLOQUEADO',
        bloqueadoEm: new Date(),
        expiradoEm,
      },
    });

    return { sucesso: true, reserva };
  } catch (err) {
    console.error('Erro ao criar reserva temporária:', err);
    return { sucesso: false, erroMsg: 'Erro ao criar reserva' };
  }
}

// Confirmar reserva após pagamento bem-sucedido
export async function confirmarReserva(reservaId: string): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { assento: true },
    });

    if (!reserva) throw new Error('Reserva não encontrada');

    // Atualizar status da reserva
    await tx.reserva.update({
      where: { id: reservaId },
      data: { status: 'CONFIRMADA' },
    });

    // Atualizar status do assento
    if (reserva.assento) {
      await tx.assento.update({
        where: { id: reserva.assento.id },
        data: { status: 'RESERVADO' },
      });
    }
  });
}

// Cancelar reserva e liberar assento
export async function cancelarReserva(reservaId: string): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { assento: true },
    });

    if (!reserva) throw new Error('Reserva não encontrada');

    // Atualizar status da reserva
    await tx.reserva.update({
      where: { id: reservaId },
      data: { status: 'CANCELADA' },
    });

    // Liberar assento
    if (reserva.assento) {
      await tx.assento.update({
        where: { id: reserva.assento.id },
        data: {
          status: 'LIVRE',
          bloqueadoEm: null,
          expiradoEm: null,
        },
      });
    }
  });
}

// Liberar assentos expirados (job de limpeza)
export async function liberarAssentosExpirados(): Promise<void> {
  try {
    const agora = new Date();

    // Buscar reservas PENDENTE que expiraram
    const reservasExpiradas = await prisma.reserva.findMany({
      where: {
        status: 'PENDENTE',
        expiradoEm: { lt: agora },
      },
      include: { assento: true },
    });

    for (const reserva of reservasExpiradas) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Cancelar reserva
        await tx.reserva.update({
          where: { id: reserva.id },
          data: { status: 'CANCELADA' },
        });

        // Liberar assento
        await tx.assento.update({
          where: { id: reserva.assentoId },
          data: {
            status: 'LIVRE',
            bloqueadoEm: null,
            expiradoEm: null,
          },
        });
      });
    }

    if (reservasExpiradas.length > 0) {
      console.log(`[Job Limpeza] ${reservasExpiradas.length} assento(s) liberado(s)`);
    }
  } catch (err) {
    console.error('Erro ao liberar assentos expirados:', err);
  }
}

// Helper: Formatar resposta de reserva
export function formatarReservaResponse(reserva: any): ReservaResponse {
  return {
    id_reserva: reserva.id,
    id_usuario: reserva.usuarioId,
    id_filme: reserva.filmeId,
    id_sala: reserva.salaId,
    horario: reserva.horario.toISOString(),
    assento_reservado: reserva.assento?.numero || '',
    criado_em: reserva.criadoEm.toISOString(),
    expira_em: reserva.expiradoEm.toISOString(),
  };
}
