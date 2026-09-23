# 📈 Uptime Monitor

Plataforma de diagnóstico e monitoramento de APIs/serviços. Você cadastra
uma URL, e o sistema passa a checá-la periodicamente — medindo status,
latência, headers de resposta e validade do certificado SSL — com um
dashboard que atualiza sozinho em tempo real via WebSocket.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-live%20updates-4C8DFF)

---

## Índice

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Como funciona o monitoramento](#como-funciona-o-monitoramento)
- [Stack e decisões técnicas](#stack-e-decisões-técnicas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Referência da API REST](#referência-da-api-rest)
- [Protocolo do WebSocket](#protocolo-do-websocket)
- [Scripts disponíveis](#scripts-disponíveis)
- [Deploy em produção](#deploy-em-produção)
- [Limitações conhecidas](#limitações-conhecidas)
- [Roadmap / possíveis evoluções](#roadmap--possíveis-evoluções)
- [Licença](#licença)

---

## Visão geral

O projeto é dividido em dois serviços independentes que conversam por REST
e WebSocket:

```
┌────────────────────┐        REST /api/services        ┌───────────────────────┐
│                     │ ───────────────────────────────▶ │                        │
│   Frontend (React)  │                                   │  Backend (Express)     │
│   dashboard + form   │ ◀─────────────────────────────── │  + node-cron + ws      │
│                     │      WebSocket /ws (push)         │                        │
└────────────────────┘                                   └───────────┬───────────┘
                                                                       │
                                                          checagens HTTP/HTTPS
                                                           (http / https / tls)
                                                                       │
                                                                       ▼
                                                        serviços/APIs cadastrados
```

O backend nunca depende do frontend estar aberto para continuar checando:
o agendador roda no servidor, guarda o histórico em memória e empurra cada
atualização para todos os clientes conectados via WebSocket.

## Funcionalidades

- ✅ Cadastro de serviços/APIs por URL, com intervalo de checagem configurável por serviço (10s a 60s)
- 🟢 Classificação automática de status: `up`, `degraded` (lento ou HTTP 4xx) ou `down` (erro, timeout ou HTTP 5xx)
- ⚡ Medição de latência de ponta a ponta com `performance.now()`
- 🔒 Validação de certificado SSL/TLS: emissor, data de validade e dias até expirar, com alerta visual quando está perto de vencer
- 📡 Dashboard em tempo real via WebSocket — sem polling, sem recarregar a página
- 📊 Histórico de latência por serviço, visualizado em gráfico (Recharts)
- 📈 Cálculo de uptime % com base na janela de checagens recentes
- 💾 Cache leve no navegador (`localStorage`) para a tela não ficar vazia por um instante ao recarregar, antes da resposta do servidor chegar
- 🔁 Reconexão automática do WebSocket se a conexão cair

## Como funciona o monitoramento

1. Cada serviço cadastrado guarda seu próprio `intervalSeconds` (padrão: 15s).
2. Um agendador único (`node-cron`) roda a cada 5 segundos — o "relógio" do
   sistema — e, a cada tick, verifica quais serviços já venceram seu
   intervalo individual.
3. Os serviços vencidos são checados **concorrentemente** (`Promise.all`),
   não em fila sequencial — assim um serviço lento não atrasa a checagem
   dos demais.
4. Cada checagem (`monitor.ts`) abre uma requisição HTTP/HTTPS crua com os
   módulos nativos do Node (`http`/`https`), cronometra o tempo até a
   resposta completa e, se for HTTPS, lê o certificado TLS diretamente do
   socket da resposta (`res.socket.getPeerCertificate()`) — sem depender de
   nenhuma lib externa para isso.
5. O resultado entra em uma janela deslizante de até 60 checagens por
   serviço, guardada em memória no processo do backend.
6. A atualização é transmitida (`broadcast`) por WebSocket para todo cliente
   conectado, que atualiza o card daquele serviço imediatamente.
   Critério de status a partir da resposta HTTP:

| Condição                                   | Status     |
| ------------------------------------------ | ---------- |
| HTTP 2xx/3xx e latência ≤ 2000ms           | `up`       |
| HTTP 2xx/3xx mas latência > 2000ms         | `degraded` |
| HTTP 4xx                                   | `degraded` |
| HTTP 5xx, erro de conexão ou timeout (10s) | `down`     |

## Stack e decisões técnicas

**Backend** — Node.js + TypeScript

- **Express** — API REST (`/api/services`)
- **node-cron** — agendamento das checagens periódicas
- **ws** — servidor WebSocket para push em tempo real
- **`http`/`https`/`tls` (nativos)** — a checagem em si é feita sem libs de
  HTTP client de terceiros, para ter acesso direto ao socket TLS (certificado)
  e a uma medição de latência precisa
- **Store em memória** — sem banco de dados; o estado vive no processo do
  servidor durante a sessão (trade-off deliberado — ver [Limitações](#limitações-conhecidas))
  **Frontend** — React + TypeScript
- **Vite** — bundler e dev server, com proxy de `/api` e `/ws` para o backend em dev
- **Recharts** — gráfico de latência por serviço
- **Hooks próprios** (`useServices`, `useWebSocket`) — combinam o fetch REST
  inicial com as atualizações via WebSocket em um único estado
- Sem gerenciador de estado global (Redux/Zustand) — o estado da lista de
  serviços é simples o suficiente para viver em `useState` + hooks

## Estrutura do projeto

```
uptime-monitor/
├── README.md
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── server.ts          # bootstrap do Express + HTTP server + WebSocket + scheduler
│       ├── types.ts           # tipos do domínio (Service, CheckResult, SslInfo, WsMessage...)
│       ├── store.ts           # estado em memória + cálculo de uptime/latência média
│       ├── monitor.ts         # checagem HTTP/HTTPS, latência e leitura do certificado TLS
│       ├── scheduler.ts       # node-cron: dispara checagens concorrentes por serviço
│       ├── websocket.ts       # servidor ws + broadcast para os clientes conectados
│       └── routes/
│           └── services.ts    # rotas REST: GET/POST/DELETE de serviços
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts         # proxy de /api e /ws para o backend em dev
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css           # tokens de design (paleta, tipografia)
        ├── types.ts            # espelha os tipos do backend
        ├── api.ts              # cliente REST (usa VITE_API_URL em produção)
        ├── vite-env.d.ts
        ├── hooks/
        │   ├── useServices.ts  # combina REST inicial + updates via WebSocket
        │   └── useWebSocket.ts # conexão ws com reconexão automática
        └── components/
            ├── Dashboard.tsx
            ├── AddServiceForm.tsx
            ├── ServiceCard.tsx
            ├── StatusBadge.tsx
            └── ResponseTimeChart.tsx
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior (usa `fetch`/`performance`
  nativos e módulos ESM)
- npm (vem junto com o Node)

## Rodando localmente

Abra **dois terminais** — um para cada serviço.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Sobe em `http://localhost:4000`. A API REST fica em `/api/services` e o
WebSocket em `/ws`. Health check simples em `GET /api/health`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Sobe em `http://localhost:5173`. Em dev, o Vite faz proxy de `/api` e `/ws`
para `localhost:4000` automaticamente (ver `vite.config.ts`), então não é
preciso configurar CORS nem URLs manualmente para rodar local.

Abra `http://localhost:5173`, cadastre uma URL (ex: `https://github.com`) e
acompanhe a primeira checagem aparecer em poucos segundos.

## Variáveis de ambiente

### `backend/.env`

| Variável                         | Padrão                  | Descrição                                                 |
| -------------------------------- | ----------------------- | --------------------------------------------------------- |
| `PORT`                           | `4000`                  | Porta da API/WebSocket                                    |
| `DEFAULT_CHECK_INTERVAL_SECONDS` | `15`                    | Intervalo usado quando o serviço não define o seu próprio |
| `CORS_ORIGIN`                    | `http://localhost:5173` | Origem permitida a chamar a API (URL do frontend)         |

### `frontend/.env` (opcional em dev)

| Variável       | Padrão                | Descrição                                                                                     |
| -------------- | --------------------- | --------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | _(vazio → usa proxy)_ | URL completa do backend. Necessário em produção quando front e back estão em hosts separados. |

## Referência da API REST

Base: `http://localhost:4000/api` (em dev) ou a URL do seu backend publicado.

### `GET /health`

Health check simples da própria API.

```json
{ "status": "ok", "uptimeSeconds": 132 }
```

### `GET /services`

Lista todos os serviços cadastrados, com histórico e métricas calculadas.

```json
[
  {
    "id": "b2b9e6b0-...",
    "name": "GitHub",
    "url": "https://github.com",
    "intervalSeconds": 15,
    "createdAt": "2026-09-23T11:32:10.000Z",
    "uptimePercent": 100,
    "avgLatencyMs": 61,
    "lastResult": {
      "timestamp": "2026-09-23T11:34:10.000Z",
      "status": "up",
      "httpStatus": 200,
      "latencyMs": 58,
      "ssl": { "valid": true, "issuer": "DigiCert Inc", "daysUntilExpiry": 214 }
    },
    "history": [
      /* últimas até 60 checagens */
    ]
  }
]
```

### `GET /services/:id`

Detalhe de um único serviço (mesmo formato do item acima).

### `POST /services`

Cadastra um novo serviço e dispara uma checagem imediata em background.

Corpo da requisição:

```json
{
  "name": "API de Pagamentos",
  "url": "https://exemplo.com/health",
  "intervalSeconds": 30
}
```

`intervalSeconds` é opcional (mínimo `5`, padrão definido por
`DEFAULT_CHECK_INTERVAL_SECONDS`). Retorna `201` com o serviço criado, ou
`400` se `name`/`url` forem inválidos.

### `DELETE /services/:id`

Remove um serviço. Retorna `204` sem corpo, ou `404` se o `id` não existir.

## Protocolo do WebSocket

Conecte em `ws://localhost:4000/ws` (ou `wss://` em produção). Ao conectar,
o servidor envia imediatamente um snapshot completo; depois disso, só
mensagens incrementais:

```ts
type WsMessage =
  | { type: "snapshot"; services: ServiceWithHistory[] } // enviado 1x, ao conectar
  | { type: "update"; service: ServiceWithHistory } // nova checagem de um serviço
  | { type: "removed"; id: string }; // serviço deletado
```

## Scripts disponíveis

### Backend (`backend/package.json`)

| Script              | O que faz                                      |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Roda com hot-reload (`tsx watch`)              |
| `npm run build`     | Compila TypeScript → `dist/`                   |
| `npm start`         | Roda a build compilada (`node dist/server.js`) |
| `npm run typecheck` | Só checa tipos, sem gerar arquivos             |

### Frontend (`frontend/package.json`)

| Script              | O que faz                            |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Sobe o servidor de desenvolvimento   |
| `npm run build`     | Build de produção em `dist/`         |
| `npm run preview`   | Serve localmente a build de produção |
| `npm run typecheck` | Só checa tipos, sem gerar arquivos   |

## Deploy em produção

O backend precisa de um processo Node.js **persistente** — o agendador roda
a cada 5s e o WebSocket fica sempre aberto — então ele **não** funciona em
funções serverless da Vercel. A combinação recomendada é: **backend em um
serviço com processo contínuo (Render, Railway ou Fly.io) + frontend na
Vercel**.

### 1. Backend (ex: Render)

1. Crie um _Web Service_ apontando para o repositório, com **Root
   Directory** = `backend`.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Configure `CORS_ORIGIN` só depois do passo 2 (veja abaixo) — por enquanto
   pode deixar o padrão.
5. Anote a URL pública gerada (ex: `https://uptime-monitor-api.onrender.com`).
   > ⚠️ No plano gratuito, esses serviços costumam "dormir" após um tempo sem
   > tráfego — as checagens agendadas pausam até a próxima requisição acordar o
   > serviço. Para monitoramento contínuo de verdade, use um plano _always on_.

### 2. Frontend (Vercel)

1. Importe o repositório com **Root Directory** = `frontend` (o framework
   Vite é detectado automaticamente).
2. Em _Environment Variables_, adicione `VITE_API_URL` com a URL do backend
   do passo anterior — **sem barra no final**.
3. Deploy. Anote a URL pública gerada pela Vercel.

### 3. Fechando o CORS

Volte nas _Environment Variables_ do backend no Render e defina
`CORS_ORIGIN` com a URL exata da Vercel (sem barra no final). Salve — o
serviço reinicia sozinho. Sem esse passo, o navegador bloqueia as chamadas
do frontend por CORS mesmo com tudo publicado corretamente.

## Limitações conhecidas

- **Sem persistência real**: o histórico vive em memória no processo do
  backend. Reiniciar o servidor (deploy, crash, "sono" do plano gratuito)
  zera o histórico e a lista de serviços.
- **Sem autenticação**: qualquer pessoa com acesso à URL do backend pode
  listar, criar e remover serviços. Não use como está para dados sensíveis
  ou em produção multiusuário sem adicionar autenticação.
- **Um único agendador**: rodar múltiplas instâncias do backend (para escala
  horizontal) duplicaria as checagens, já que o estado e o cron não são
  compartilhados entre instâncias.

## Roadmap / possíveis evoluções

- [ ] Persistência em banco (Postgres/SQLite via Prisma, por exemplo) no lugar da store em memória
- [ ] Autenticação e monitoramento multiusuário/multiworkspace
- [ ] Alertas por e-mail, Slack ou webhook quando um serviço fica `down`
- [ ] Página pública de status (read-only), estilo status.example.com
- [ ] Histórico com retenção maior (ex: agregações por hora/dia) em vez da janela fixa de 60 checagens
- [ ] Suporte a checagens customizadas (método HTTP, headers, body, código de status esperado)
- [ ] Deploy do backend com Docker
