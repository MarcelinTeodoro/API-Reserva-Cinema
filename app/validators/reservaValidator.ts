import { z } from 'zod';

export const criarReservaSchema = z.object({
  id_usuario: z.string().min(1, 'id_usuario é obrigatório'),
  id_filme: z.string().min(1, 'id_filme é obrigatório'),
  id_sala: z.string().min(1, 'id_sala é obrigatório'),
  horario: z.string().datetime('horario deve ser uma data ISO válida'),
  assento_solicitado: z.string().min(1, 'assento_solicitado é obrigatório'),
});

export type CriarReservaDTO = z.infer<typeof criarReservaSchema>;
