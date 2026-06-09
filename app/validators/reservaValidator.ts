import { z } from "zod";

export const sessionParamsSchema = z.object({
  sessionId: z.string().min(1).max(100),
});

export const assentoRegex = /^[A-E]([1-9]|10)$/;

export const reservaBodySchema = z
  .object({
    dataHoraFim: z.coerce.date(),
    assentos: z
      .array(z.string().regex(assentoRegex))
      .min(1)
      .max(50)
      .superRefine((assentos, ctx) => {
        const vistos = new Set<string>();
        const duplicados = new Set<string>();

        for (const assento of assentos) {
          if (vistos.has(assento)) duplicados.add(assento);
          vistos.add(assento);
        }

        if (duplicados.size > 0) {
          ctx.addIssue({
            code: "custom",
            message: `Assentos duplicados na requisicao: ${Array.from(
              duplicados
            ).join(", ")}.`,
          });
        }
      }),
  })
  .passthrough();

export type ReservaBody = z.infer<typeof reservaBodySchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
