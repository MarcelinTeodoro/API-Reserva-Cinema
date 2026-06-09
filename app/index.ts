import "dotenv/config";
import { buildServer } from "./server";
import {
  iniciarCronLiberacao,
  liberarAssentosPendentesExpirados,
} from "./jobs/liberarPendentes";
import {
  instalarEspelhoDoConsole,
  registrarLogConsole,
} from "./lib/dashboardConsole";

function validarAmbiente() {
  const grupoCUrl = process.env.GRUPO_C_URL?.trim();

  if (!grupoCUrl) {
    console.error("[env] GRUPO_C_URL nao configurada. Informe a URL do Grupo C.");
    process.exit(1);
  }

  process.env.GRUPO_C_URL = grupoCUrl;
}

async function main() {
  instalarEspelhoDoConsole();
  validarAmbiente();

  const app = buildServer();
  const port = Number(process.env.PORT ?? 6999);

  try {
    const liberados = await liberarAssentosPendentesExpirados();
    console.log(
      `[startup] Limpeza inicial de pendentes: ${liberados} assento(s) liberado(s).`
    );

    await app.listen({ port, host: "0.0.0.0" });
    console.log(`[server] API do Grupo B rodando na porta ${port}.`);
    iniciarCronLiberacao();
  } catch (err) {
    app.log.error(err);
    registrarLogConsole("ERROR", "SERVER", "Falha ao iniciar a API.");
    process.exit(1);
  }
}

main();
