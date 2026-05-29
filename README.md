# API-Reserva-Cinema

API do Grupo B para gerenciamento de reservas de assentos de cinema.

## Setup

1. Instalar dependencias:

```bash
npm install
```

2. Configurar variaveis de ambiente:

- Copiar `.env.example` para `.env`
- Atualizar `DATABASE_URL`, se necessario
- Atualizar `GRUPO_C_URL` com a URL real do Grupo C

3. Executar as migrations:

```bash
npx prisma migrate dev
```

4. Gerar o Prisma Client:

```bash
npx prisma generate
```

5. Rodar em desenvolvimento:

```bash
npm run dev
```

Ou rodar diretamente:

```bash
npm start
```

Por padrao, o servidor roda em:

```text
http://localhost:6999
```

Dashboard web:

```text
http://localhost:6999/
```

## Variaveis de Ambiente

```env
DATABASE_URL="file:./dev.db"
PORT=6999
GRUPO_C_URL="https://url-do-grupo-c"
```

## Assentos

A sala possui 50 assentos, de `A1` ate `E10`.

Estados internos dos assentos:

- `PENDENTE`: assento bloqueado enquanto a API aguarda o Grupo C
- `OCUPADO`: reserva confirmada

Assentos disponiveis nao ficam gravados como linhas fixas no banco. Eles sao calculados removendo da lista total os assentos pendentes ou ocupados.

## Rotas

### GET /

Abre o dashboard web com visao de sessoes e mapa de assentos.

### GET /dashboard/logs

Retorna logs do console do dashboard (entradas e respostas HTTP em memoria).

Query params opcionais:

- `since`: retorna apenas logs com `id` maior que esse valor
- `limit`: quantidade maxima de linhas (padrao 120, maximo 250)

Resposta:

```json
{
  "logs": [
    {
      "id": 10,
      "timestamp": "2026-05-29T23:11:22.000Z",
      "level": "SUCCESS",
      "source": "HTTP",
      "message": "<< GET /sessoes 200 (5ms)"
    }
  ],
  "cursor": 10,
  "totalBuffer": 18
}
```

### GET /sessoes

Lista resumo das sessoes registradas no banco.

Resposta:

```json
{
  "sessoes": [
    {
      "sessionId": "sessao-1",
      "dataHoraFim": "2026-06-01T23:00:00.000Z",
      "encerrada": false,
      "resumo": {
        "disponiveis": 45,
        "pendentes": 1,
        "ocupados": 4,
        "capacidadeTotal": 50,
        "taxaOcupacao": 8
      }
    }
  ]
}
```

### GET /sessoes/:sessionId/mapa

Retorna o mapa completo de 50 assentos da sessao com status por assento.

Resposta:

```json
{
  "sessionId": "sessao-1",
  "existe": true,
  "dataHoraFim": "2026-06-01T23:00:00.000Z",
  "encerrada": false,
  "resumo": {
    "disponiveis": 45,
    "pendentes": 1,
    "ocupados": 4,
    "capacidadeTotal": 50,
    "taxaOcupacao": 8
  },
  "assentos": [
    { "numero": "A1", "status": "DISPONIVEL" },
    { "numero": "A2", "status": "OCUPADO" }
  ]
}
```

### GET /sessoes/:sessionId/assentos

Lista os assentos disponiveis de uma sessao.

Resposta:

```json
{
  "sessionId": "sessao-1",
  "assentos": ["A1", "A2", "A3"]
}
```

### POST /sessoes/:sessionId/reservas

Cria uma reserva para uma sessao.

Entrada:

```json
{
  "dataHoraFim": "2026-06-01T23:00:00.000Z",
  "assentos": ["A1", "A2"],
  "id_usuario": "user_789",
  "id_filme": "filme_123",
  "id_sala": "sala_04",
  "horario": "2026-06-01T20:00:00.000Z"
}
```

A API valida apenas `dataHoraFim` e `assentos`. O body recebido pela API e enviado para o Grupo C com todos os campos originais, inclusive campos que o Grupo B nao utiliza.

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

O campo `grupoC` contem o retorno do Grupo C sem remover campos.

Erros principais:

- `400`: dados invalidos ou sessao encerrada
- `409`: um ou mais assentos indisponiveis
- `504`: Grupo C nao respondeu em ate 15 segundos
- `500`: erro interno

Formato padrao de erro:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Mensagem amigavel sobre o erro",
  "details": []
}
```

`details` e opcional. Em erros de validacao, contem os detalhes do Zod. Em erros retornados pelo Grupo C, contem exatamente o payload retornado pelo Grupo C.

### GET /admin/limpeza-sessoes

Remove sessoes encerradas e seus assentos ocupados.

Resposta:

```json
{
  "mensagem": "Limpeza concluida",
  "sessoesLimpas": 1,
  "assentosOcupadosRemovidos": 2
}
```

## Fluxo da Reserva

1. A API recebe `POST /sessoes/:sessionId/reservas`.
2. Valida `sessionId`, `dataHoraFim` e `assentos`.
3. Cria ou atualiza a sessao no banco.
4. Confere se os assentos estao livres.
5. Marca os assentos como `PENDENTE` em uma transacao.
6. Envia o body original para o Grupo C, sem filtrar campos.
7. Se o Grupo C aprovar, marca os assentos como `OCUPADO` e devolve o retorno dele em `grupoC`.
8. Se o Grupo C falhar ou demorar mais de 15 segundos, libera os assentos pendentes. Se houver payload de erro do Grupo C, ele volta completo em `details`.
9. A cada 5 segundos durante a chamada ao Grupo C, a API imprime um aviso no console para mostrar que ela ainda esta rodando e aguardando a outra equipe.

## Limpeza Automatica

Assentos pendentes antigos sao liberados automaticamente pelo job interno.

Config atual:

- Intervalo do job: 5 minutos
- Tempo para considerar pendente expirado: 6 minutos

## Arquitetura

- `app/validators/`: schemas Zod
- `app/models/`: acesso ao banco e regras de assentos
- `app/controllers/`: handlers das rotas
- `app/services/`: integracao com Grupo C
- `app/jobs/`: limpeza de pendentes
- `app/server.ts`: setup Fastify
- `prisma/schema.prisma`: estrutura do banco
