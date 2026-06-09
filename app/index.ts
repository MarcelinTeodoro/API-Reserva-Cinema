import "dotenv/config";
import { buildServer } from "./server";
import { iniciarCronLiberacao } from "./jobs/liberarPendentes";
import {
  instalarEspelhoDoConsole,
  registrarLogConsole,
} from "./lib/dashboardConsole";

async function main() {
  instalarEspelhoDoConsole();
  const app = buildServer();
  const port = Number(process.env.PORT ?? 6999);

  try {
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
