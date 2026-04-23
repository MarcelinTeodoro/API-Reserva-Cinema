import { z } from "zod";

export const sessionParamsSchema = z.object({
  sessionId: z.string().min(1),
});

export const assentoRegex = /^[A-E]([1-9]|10)$/;

export const reservaBodySchema = z
  .object({
    dataHoraFim: z.coerce.date(),
    assentos: z.array(z.string().regex(assentoRegex)).min(1),
  })
  .passthrough();

export type ReservaBody = z.infer<typeof reservaBodySchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
