# Uptime Monitor

Painel de diagnóstico e monitoramento de APIs/serviços: cadastre URLs e
acompanhe status, latência, headers de resposta e validade do certificado
SSL em tempo real.

## Stack

- **Backend:** Node.js + TypeScript, Express, `node-cron` (agendamento),
  `ws` (WebSocket para push em tempo real), módulos nativos `http`/`https`/`tls`
  para as checagens (sem depender de libs de terceiros para o core).
- **Frontend:** React + TypeScript, Vite, Recharts (gráfico de latência),
  estado em memória + cache leve em `localStorage`.

## Como o monitoramento funciona

1. Cada serviço cadastrado tem um `intervalSeconds` próprio (padrão 15s).
2. Um agendador (`node-cron`) roda a cada 5s e dispara, **concorrentemente**
   (`Promise.all`), a checagem de todos os serviços cujo intervalo já venceu.
3. Cada checagem mede a latência de ponta a ponta com `performance.now()`,
   lê o `statusCode` e os headers da resposta e, para HTTPS, extrai dados do
   certificado TLS via `res.socket.getPeerCertificate()` (emissor, validade,
   dias até expirar).
4. O resultado é guardado em uma janela deslizante em memória (últimas 60
   checagens por serviço) e transmitido via WebSocket para todos os clientes
   conectados — por isso o dashboard atualiza sozinho, sem polling.

## Rodando localmente

Abra dois terminais.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

A API sobe em `http://localhost:4000` (REST em `/api/services`, WebSocket em `/ws`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`. O Vite já faz proxy de `/api` e `/ws` para o
backend, então não é preciso configurar CORS manualmente em dev.

## Endpoints da API

| Método | Rota                  | Descrição                                   |
| ------ | ---------------------- | -------------------------------------------- |
| GET    | `/api/services`        | Lista todos os serviços com histórico        |
| GET    | `/api/services/:id`    | Detalhe de um serviço                        |
| POST   | `/api/services`        | Cadastra um serviço `{ name, url, intervalSeconds? }` |
| DELETE | `/api/services/:id`    | Remove um serviço                            |
| GET    | `/api/health`          | Health check da própria API                  |

## Deploy em produção

O backend precisa de um processo Node.js **persistente** (o agendador roda a
cada 5s e o WebSocket fica sempre aberto), então ele não funciona em funções
serverless da Vercel. A combinação simples é: **backend no Render/Railway/Fly.io
+ frontend na Vercel**.

### 1. Backend (ex: Render)

1. Crie um "Web Service" novo apontando para este repositório, com **Root
   Directory** = `backend`.
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Variáveis de ambiente: `CORS_ORIGIN` = URL do seu frontend na Vercel (ex:
   `https://seu-projeto.vercel.app`). `PORT` normalmente é definida
   automaticamente pela plataforma.
5. Anote a URL pública gerada (ex: `https://uptime-monitor-api.onrender.com`).

> No plano gratuito de algumas dessas plataformas o serviço "dorme" após um
> tempo sem tráfego — as checagens agendadas pausam até a próxima requisição
> acordar o serviço. Para monitoramento 24/7 de verdade, use um plano pago ou
> um serviço "always on".

### 2. Frontend (Vercel)

1. Importe este repositório na Vercel com **Root Directory** = `frontend`
   (framework detectado automaticamente como Vite).
2. Em Environment Variables, adicione `VITE_API_URL` com a URL do backend do
   passo anterior, **sem barra no final** (ex:
   `https://uptime-monitor-api.onrender.com`).
3. Deploy. O frontend passa a falar diretamente com o backend publicado (REST
   e WebSocket) em vez de usar o proxy relativo do Vite, que só existe em dev.

## Possíveis evoluções

- Persistência em banco (Postgres/SQLite) no lugar da store em memória.
- Autenticação e monitoramento multiusuário.
- Alertas por e-mail/webhook quando um serviço fica `down`.
- Deploy do backend com Docker + PM2/systemd para rodar de forma contínua.
