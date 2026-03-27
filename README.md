# API-Reserva-Cinema

API do Grupo B - Gerenciamento de Reservas de Assentos

## Setup

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Configurar variáveis de ambiente:**
   - Copiar `.env.example` para `.env`
   - Atualizar `DATABASE_URL` com sua conexão
   - Atualizar `GRUPO_C_URL` com a URL real do Grupo C (Pagamentos)

3. **Executar migrações Prisma:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Rodar em desenvolvimento:**
   ```bash
   npm run dev
   ```

   Ou rodar em produção:
   ```bash
   npm start
   ```

O servidor estará disponível em `http://localhost:3333`

## API

### POST /reservas

Criar uma reserva de assento.

**Entrada:**
```json
{
  "id_usuario": "user_789",
  "id_filme": "filme_123",
  "id_sala": "sala_04",
  "horario": "2026-03-13T20:00:00Z",
  "assento_solicitado": "H10"
}
```

**Resposta (201):**
```json
{
  "id_reserva": "res_abc123",
  "id_usuario": "user_789",
  "id_filme": "filme_123",
  "id_sala": "sala_04",
  "horario": "2026-03-13T20:00:00Z",
  "assento_reservado": "H10",
  "criado_em": "2026-03-13T09:20:00Z",
  "expira_em": "2026-03-13T09:30:00Z"
}
```

**Erros:**
- `409` - Assento indisponível
- `402` - Pagamento recusado
- `400` - Dados inválidos
- `500` - Erro interno

## Fluxo

1. Validar entrada (Zod)
2. Bloquear assento por 10 minutos
3. Enviar para Grupo C (pagamento)
4. Se sucesso: confirmar reserva
5. Se erro: desfazer bloqueio e retornar erro

Assentos expirados são liberados automaticamente a cada 1 minuto.

## Arquitetura

- `app/validators/` - Schemas Zod para validação
- `app/models/` - Lógica de negócio (reservas, integração com Grupo C)
- `app/controllers/` - Rotas da API
- `app/server.ts` - Setup Fastify
- `prisma/schema.prisma` - Modelos de dados