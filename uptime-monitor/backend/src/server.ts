import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { servicesRouter } from "./routes/services.js";
import { startScheduler } from "./scheduler.js";
import { initWebSocket } from "./websocket.js";

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});

app.use("/api/services", servicesRouter);

const httpServer = createServer(app);
initWebSocket(httpServer);
startScheduler();

httpServer.listen(PORT, () => {
  console.log(`Uptime Monitor API rodando em http://localhost:${PORT}`);
  console.log(`WebSocket disponível em ws://localhost:${PORT}/ws`);
});
