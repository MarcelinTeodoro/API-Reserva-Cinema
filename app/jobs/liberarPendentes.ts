import { prisma } from "../lib/prisma";
import { STATUS } from "../lib/assentos";

const INTERVALO_MS = 5 * 60 * 1000;
const EXPIRACAO_MS = 6 * 60 * 1000;

export async function liberarAssentosPendentesExpirados() {
  const limite = new Date(Date.now() - EXPIRACAO_MS);
  const resultado = await prisma.assento.deleteMany({
    where: {
      status: STATUS.PENDENTE,
      atualizadoEm: { lt: limite },
    },
  });
  return resultado.count;
}

export function iniciarCronLiberacao() {
  return setInterval(async () => {
    try {
      const liberados = await liberarAssentosPendentesExpirados();
      if (liberados > 0) {
        console.log(`[cron] ${liberados} assento(s) pendente(s) liberado(s).`);
      }
    } catch (err) {
      console.error("[cron] erro ao liberar pendentes:", err);
    }
  }, INTERVALO_MS);
}
