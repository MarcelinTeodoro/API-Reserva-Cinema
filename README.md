# API-Reserva-Cinema

API do Grupo B para reserva de assentos de cinema, desenvolvida para demonstrar um fluxo distribuido na disciplina de Sistemas Distribuidos do curso de Ciencia da Computacao.

O objetivo do projeto e permitir testes rapidos e demonstraveis entre o Grupo B e o Grupo C. Autenticacao, autorizacao e infraestrutura de producao, como filas, circuit breaker, idempotencia e migracao para PostgreSQL, nao foram adicionadas de forma intencional.

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Criar o arquivo `.env` a partir de `.env.example` e configurar as variaveis:

```env
DATABASE_URL="file:./dev.db"
PORT=6999
GRUPO_C_URL="https://url-do-grupo-c/reservas"
DEMO_PENDING_DELAY_MS=0
```

3. Gerar o Prisma Client:

```bash
npx prisma generate
```

4. Executar as migrations:

```bash
npx prisma migrate dev
```

5. Rodar em desenvolvimento:

```bash
npm run dev
```

Servidor padrao:

```text
http://localhost:6999
```

Dashboard:

```text
http://localhost:6999/
```

## Variaveis de Ambiente

- `DATABASE_URL`: caminho do banco SQLite usado pelo Prisma.
- `PORT`: porta da API. Opcional, default `6999`.
- `GRUPO_C_URL`: URL do endpoint do Grupo C. Obrigatoria no startup.
- `DEMO_PENDING_DELAY_MS`: atraso opcional, em milissegundos, apos aprovacao do Grupo C e antes de confirmar `OCUPADO`. Default `0`.

Se `GRUPO_C_URL` estiver ausente ou vazia, a API registra erro claro e encerra o processo.

## Endpoints

### GET /

Abre o dashboard web com sessoes, mapa de assentos, legenda, console de fluxo distribuido e console tecnico.

### GET /health

Retorna o status basico da API.

```json
{
  "status": "ok",
  "service": "api-reserva-cinema",
  "timestamp": "2026-06-09T12:00:00.000Z"
}
```

### GET /dashboard/logs

Retorna logs em memoria para o console do dashboard.

Query params opcionais:

- `since`: retorna logs com `id` maior que esse valor.
- `limit`: quantidade maxima de linhas. Padrao `120`, maximo `250`.

### GET /dashboard/flow-events

Retorna os eventos do Distributed Flow Console usado na demonstracao academica.

Esse console mostra apenas eventos relevantes do fluxo entre Grupo A, Grupo B, banco de dados e Grupo C. Requisicoes automaticas do dashboard, como polling de sessoes, mapa e logs, ficam fora desse console para evitar ruido durante a apresentacao.

Eventos exibidos incluem consulta de assentos, reserva recebida, assentos `PENDENTE`, envio ao Grupo C, resposta do Grupo C, confirmacao `OCUPADO`, liberacao apos erro ou timeout e resultado da limpeza.

### GET /sessoes

Lista resumo das sessoes registradas.

```json
{
  "sessoes": [
    {
      "sessionId": "sessao-1",
      "dataHoraFim": "2026-06-09T22:00:00.000Z",
      "encerrada": false,
      "resumo": {
        "disponiveis": 48,
        "pendentes": 1,
        "ocupados": 1,
        "capacidadeTotal": 50,
        "taxaOcupacao": 2
      }
    }
  ]
}
```

### GET /sessoes/:sessionId/mapa

Retorna o mapa completo de 50 assentos da sessao.

Status possiveis:

- `DISPONIVEL`
- `PENDENTE`
- `OCUPADO`

### GET /sessoes/:sessionId/assentos

Lista os assentos disponiveis de uma sessao.

```json
{
  "sessionId": "sessao-1",
  "assentos": ["A1", "A2", "A3"]
}
```

### POST /sessoes/:sessionId/reservas

Cria uma reserva e encaminha o body original ao Grupo C.

Entrada:

```json
{
  "dataHoraFim": "2026-06-09T22:00:00.000Z",
  "assentos": ["A1", "A2"],
  "id_usuario": "user_789",
  "id_filme": "filme_123",
  "id_sala": "sala_04",
  "horario": "2026-06-09T20:00:00.000Z"
}
```

Validacoes principais:

- `sessionId`: obrigatorio, ate 100 caracteres.
- `dataHoraFim`: data obrigatoria.
- `assentos`: lista obrigatoria, ate 50 itens.
- Assentos validos: `A1` ate `E10`.
- Assentos duplicados no mesmo request retornam `400`.
- Se a sessao ja existir, `dataHoraFim` deve ser igual ao valor salvo no banco.
- Se a sessao ja estiver encerrada pelo valor salvo no banco, retorna `400`.

Resposta de sucesso:

```json
{
  "sessionId": "sessao-1",
  "assentos": ["A1", "A2"],
  "status": "OCUPADO",
  "grupoC": {
    "status": "aprovado"
  }
}
```

Erros principais:

- `400`: dados invalidos, sessao encerrada ou `dataHoraFim` divergente.
- `409`: um ou mais assentos indisponiveis.
- `504`: Grupo C nao respondeu em ate 15 segundos.
- `500`: erro interno.

### POST /admin/limpeza-sessoes

Remove sessoes encerradas e todos os assentos vinculados a elas, incluindo `PENDENTE` e `OCUPADO`.

```json
{
  "mensagem": "Limpeza concluida",
  "sessoesLimpas": 1,
  "assentosRemovidos": 3,
  "assentosOcupadosRemovidos": 3
}
```

`assentosOcupadosRemovidos` permanece por compatibilidade com clientes antigos.

## Fluxo da Reserva

1. A API recebe `POST /sessoes/:sessionId/reservas`.
2. Valida `sessionId`, `dataHoraFim` e `assentos`.
3. Busca a sessao no banco.
4. Se a sessao nao existir, cria usando `dataHoraFim` do request.
5. Se a sessao existir, nao altera `dataHoraFim`; divergencia retorna `400`.
6. Valida encerramento usando `dataHoraFim` salvo no banco.
7. Confere se os assentos estao livres.
8. Marca os assentos como `PENDENTE`.
9. Envia o body original para o Grupo C.
10. Se o Grupo C aprovar, marca os assentos como `OCUPADO`.
11. Se o Grupo C falhar ou exceder o timeout, libera os assentos pendentes.

O dashboard mostra os estados `DISPONIVEL`, `PENDENTE` e `OCUPADO`, com atualizacao automatica curta para facilitar a apresentacao. Mudancas de status no mapa recebem destaque visual curto sem recriar todo o mapa.

O Distributed Flow Console agrupa eventos por fluxo para mostrar, de forma legivel, o caminho da reserva entre Grupo A, Grupo B, banco de dados e Grupo C.

## Limpeza

Assentos `PENDENTE` antigos sao liberados automaticamente.

- No startup, a API executa uma limpeza inicial e registra quantos assentos foram liberados.
- Depois do startup, o job periodico continua rodando a cada 5 minutos.
- Um assento `PENDENTE` e considerado expirado apos 6 minutos sem atualizacao.

Sessoes encerradas podem ser removidas manualmente em `POST /admin/limpeza-sessoes`. A contagem retornada inclui todos os assentos removidos por cascade.

## Demo

Para visualizar o estado `PENDENTE` no dashboard:

1. Configure um valor positivo em `.env`:

```env
DEMO_PENDING_DELAY_MS=5000
```

2. Inicie a API:

```bash
npm run dev
```

3. Abra o dashboard em `http://localhost:6999/`.
4. Envie uma reserva valida.
5. Apos aprovacao do Grupo C, os assentos permanecem `PENDENTE` pelo tempo configurado antes de virar `OCUPADO`.
6. Acompanhe o Distributed Flow Console para visualizar o fluxo sem ruido de polling automatico.

## Testes Manuais

Rodar comandos base:

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Cenarios:

1. Iniciar sem `GRUPO_C_URL` e verificar falha com mensagem clara.
2. Iniciar com `GRUPO_C_URL` e verificar `GET /health`.
3. Criar reserva e verificar assentos `PENDENTE` antes da aprovacao.
4. Usar `DEMO_PENDING_DELAY_MS` e verificar `PENDENTE` visivel no dashboard.
5. Tentar reservar o mesmo assento duas vezes e verificar `409`.
6. Enviar assentos duplicados no mesmo request e verificar `400`.
7. Enviar `dataHoraFim` diferente para sessao existente e verificar `400`.
8. Reiniciar com assentos `PENDENTE` expirados e verificar limpeza no startup.
9. Rodar `POST /admin/limpeza-sessoes` e verificar contagem correta de assentos removidos.
10. Verificar que `GET /admin/limpeza-sessoes` nao remove dados.
11. Verificar que os cards de resumo nao piscam quando os valores nao mudam.
12. Verificar que o Distributed Flow Console nao mostra polling automatico do dashboard.
13. Criar reserva com sucesso e com falha/timeout do Grupo C para validar os eventos do fluxo.
14. Verificar destaque visual nas transicoes `DISPONIVEL` -> `PENDENTE` -> `OCUPADO`.

## Estrutura

- `app/validators/`: schemas Zod.
- `app/models/`: acesso ao banco e regras de assentos.
- `app/controllers/`: handlers das rotas.
- `app/services/`: integracao com Grupo C.
- `app/jobs/`: limpeza de pendentes.
- `app/public/`: dashboard.
- `app/server.ts`: setup Fastify.
- `prisma/schema.prisma`: estrutura do banco.
