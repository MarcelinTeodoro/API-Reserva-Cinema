import { STATUS_CODES } from "node:http";
import { FastifyReply } from "fastify";

export type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
};

export function buildErrorResponse(
  statusCode: number,
  message: string,
  details?: unknown
): ErrorResponse {
  const response: ErrorResponse = {
    statusCode,
    error: STATUS_CODES[statusCode] ?? "Error",
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  message: string,
  details?: unknown
) {
  return reply.status(statusCode).send(
    buildErrorResponse(statusCode, message, details)
  );
}
