import { FastifyInstance } from "fastify";
import { listarAssentos } from "../controllers/assentosController";
import { criarReserva } from "../controllers/reservasController";
import { limpezaSessoes } from "../controllers/adminController";
import {
  listarSessoes,
  obterMapaSessao,
} from "../controllers/sessoesController";
import {
  entregarDashboardCss,
  entregarDashboardJs,
  mostrarDashboard,
} from "../controllers/dashboardController";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/", mostrarDashboard);
  app.get("/dashboard.css", entregarDashboardCss);
  app.get("/dashboard.js", entregarDashboardJs);
  app.get("/sessoes", listarSessoes);
  app.get("/sessoes/:sessionId/mapa", obterMapaSessao);
  app.get("/sessoes/:sessionId/assentos", listarAssentos);
  app.post("/sessoes/:sessionId/reservas", criarReserva);
  app.get("/admin/limpeza-sessoes", limpezaSessoes);
}
