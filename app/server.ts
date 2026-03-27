import Fastify from 'fastify';
import { criarReserva } from './controllers/reservasController';
import { liberarAssentosExpirados } from './models/reservaModel';

const app = Fastify();

// Job de limpeza: liberar assentos expirados a cada 1 minuto
const jobLimpeza = setInterval(() => {
  liberarAssentosExpirados();
}, 60 * 1000); // 1 minuto

// Rota: POST /reservas
app.post<{ Body: any }>('/reservas', async (request, reply) => {
  await criarReserva(request, reply);
});

// Limpeza ao desligar
process.on('SIGTERM', () => {
  clearInterval(jobLimpeza);
  app.close();
});

export async function start(porta: number = 3333) {
  try {
    await app.listen({ port: porta, host: '0.0.0.0' });
    console.log(`✓ Servidor rodando na porta ${porta}`);
  } catch (err) {
    console.error('Erro ao iniciar servidor:', err);
    process.exit(1);
  }
}

export default app;
