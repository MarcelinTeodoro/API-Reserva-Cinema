import { inspect } from "node:util";

export type ConsoleLogLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR";

export type ConsoleLogEntry = {
  id: number;
  timestamp: string;
  level: ConsoleLogLevel;
  source: string;
  message: string;
};

const MAX_LOG_BUFFER = 600;
const DEFAULT_LIMIT = 120;
const MIN_LIMIT = 1;
const MAX_LIMIT = 250;
const MAX_LOG_MESSAGE = 1600;

const logBuffer: ConsoleLogEntry[] = [];
let nextLogId = 1;
let espelhoConsoleInstalado = false;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function registrarLogConsole(
  level: ConsoleLogLevel,
  source: string,
  message: string
) {
  const entry: ConsoleLogEntry = {
    id: nextLogId++,
    timestamp: new Date().toISOString(),
    level,
    source,
    message:
      message.length > MAX_LOG_MESSAGE
        ? `${message.slice(0, MAX_LOG_MESSAGE)} ...[truncado]`
        : message,
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER) {
    logBuffer.splice(0, logBuffer.length - MAX_LOG_BUFFER);
  }

  return entry;
}

function serializarValorLog(valor: unknown) {
  if (typeof valor === "string") return valor;
  if (valor instanceof Error) return valor.stack ?? valor.message;

  if (typeof valor === "object" && valor !== null) {
    try {
      return JSON.stringify(valor);
    } catch (_err) {
      return inspect(valor, { depth: 4, colors: false, breakLength: 100 });
    }
  }

  return String(valor);
}

function extrairOrigemConsole(primeiroArg: unknown) {
  if (typeof primeiroArg !== "string") return "CONSOLE";
  const match = primeiroArg.match(/^\[([^\]]+)\]/);
  if (!match) return "CONSOLE";
  return match[1].trim().toUpperCase().slice(0, 24) || "CONSOLE";
}

function registrarEspelho(
  level: ConsoleLogLevel,
  method: "log" | "info" | "warn" | "error"
) {
  const original = console[method].bind(console);

  console[method] = (...args: unknown[]) => {
    try {
      const source = extrairOrigemConsole(args[0]);
      const message = args.map(serializarValorLog).join(" ");
      registrarLogConsole(level, source, message);
    } catch (_err) {
      // Ignora erros internos do espelho para nao afetar o fluxo principal.
    }

    original(...args);
  };
}

export function instalarEspelhoDoConsole() {
  if (espelhoConsoleInstalado) return;

  registrarEspelho("INFO", "log");
  registrarEspelho("INFO", "info");
  registrarEspelho("WARN", "warn");
  registrarEspelho("ERROR", "error");

  espelhoConsoleInstalado = true;
}

export function listarLogsConsole(options?: { sinceId?: number; limit?: number }) {
  const sinceId = Number.isFinite(options?.sinceId) ? (options?.sinceId ?? 0) : 0;
  const requestedLimit = Number.isFinite(options?.limit)
    ? (options?.limit ?? DEFAULT_LIMIT)
    : DEFAULT_LIMIT;
  const limit = clamp(Math.floor(requestedLimit), MIN_LIMIT, MAX_LIMIT);

  const fonte = sinceId > 0 ? logBuffer.filter((item) => item.id > sinceId) : logBuffer;
  const logs = fonte.slice(-limit);
  const cursor = logs.length > 0 ? logs[logs.length - 1].id : nextLogId - 1;

  return {
    logs,
    cursor,
    totalBuffer: logBuffer.length,
  };
}
