import { FastifyInstance } from "fastify";
import { listarAssentos } from "../controllers/assentosController";
import { criarReserva } from "../controllers/reservasController";
import { limpezaSessoes } from "../controllers/adminController";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/sessoes/:sessionId/assentos", listarAssentos);
  app.post("/sessoes/:sessionId/reservas", criarReserva);
  app.get("/admin/limpeza-sessoes", limpezaSessoes);
}
