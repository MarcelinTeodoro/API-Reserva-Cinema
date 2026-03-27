import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { criarReservaSchema } from '../validators/reservaValidator';
import { criarReservaTemporaria, confirmarReserva, cancelarReserva, formatarReservaResponse } from '../models/reservaModel';
import { enviarParaPagamento } from '../models/grupoC';

export async function criarReserva(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Validar entrada
    const dados = criarReservaSchema.parse(request.body);

    // Etapa 1: Criar reserva temporária e bloquear assento
    const resultadoReserva = await criarReservaTemporaria(dados);

    if (!resultadoReserva.sucesso) {
      return reply.status(409).send({
        erro: 'ASSENTO_INDISPONIVEL',
        mensagem: resultadoReserva.erroMsg || 'Assento não está disponível',
      });
    }

    const reserva = resultadoReserva.reserva;
    const reservaFormatada = formatarReservaResponse(resultadoReserva.reserva);

    // Etapa 2: Enviar para Grupo C (Pagamentos)
    const resultadoPagamento = await enviarParaPagamento(reservaFormatada);

    if (!resultadoPagamento.sucesso) {
      // Pagamento recusado: desfazer bloqueio
      await cancelarReserva(reserva.id);

      return reply.status(402).send({
        erro: 'PAGAMENTO_RECUSADO',
        mensagem: resultadoPagamento.erro?.mensagem || 'Pagamento foi recusado',
        detalhes: resultadoPagamento.erro,
      });
    }

    // Etapa 3: Confirmar reserva
    await confirmarReserva(reserva.id);

    // Retornar resposta com dados formatados
    return reply.status(201).send(reservaFormatada);
  } catch (err) {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        erro: 'VALIDACAO_FALHOU',
        mensagem: 'Dados inválidos fornecidos',
        detalhes: err.issues,
      });
    }

    console.error('Erro ao criar reserva:', err);
    return reply.status(500).send({
      erro: 'ERRO_INTERNO',
      mensagem: 'Erro ao processar reserva',
    });
  }
}
