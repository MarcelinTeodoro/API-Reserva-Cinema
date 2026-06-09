export type FlowEventLevel = "INFO" | "SUCCESS" | "WARN" | "ERROR";

export type FlowEvent = {
  id: number;
  timestamp: string;
  flowId: string;
  level: FlowEventLevel;
  from: string;
  to: string;
  message: string;
  sessionId?: string;
  assentos?: string[];
};

const MAX_FLOW_EVENTS = 500;
const DEFAULT_LIMIT = 120;
const MIN_LIMIT = 1;
const MAX_LIMIT = 250;

const flowEvents: FlowEvent[] = [];
let nextFlowEventId = 1;
let nextFlowId = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function criarFlowId(prefix: string) {
  return `${prefix}-${Date.now()}-${nextFlowId++}`;
}

export function registrarFlowEvent(event: Omit<FlowEvent, "id" | "timestamp">) {
  const entry: FlowEvent = {
    id: nextFlowEventId++,
    timestamp: new Date().toISOString(),
    ...event,
  };

  flowEvents.push(entry);
  if (flowEvents.length > MAX_FLOW_EVENTS) {
    flowEvents.splice(0, flowEvents.length - MAX_FLOW_EVENTS);
  }

  return entry;
}

export function listarFlowEvents(options?: { sinceId?: number; limit?: number }) {
  const sinceId = Number.isFinite(options?.sinceId) ? (options?.sinceId ?? 0) : 0;
  const requestedLimit = Number.isFinite(options?.limit)
    ? (options?.limit ?? DEFAULT_LIMIT)
    : DEFAULT_LIMIT;
  const limit = clamp(Math.floor(requestedLimit), MIN_LIMIT, MAX_LIMIT);

  const fonte =
    sinceId > 0 ? flowEvents.filter((item) => item.id > sinceId) : flowEvents;
  const events = fonte.slice(-limit);
  const cursor = events.length > 0 ? events[events.length - 1].id : nextFlowEventId - 1;

  return {
    events,
    cursor,
    totalBuffer: flowEvents.length,
  };
}
