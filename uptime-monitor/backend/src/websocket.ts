import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { listServicesWithHistory } from "./store.js";
import type { WsMessage } from "./types.js";

let wss: WebSocketServer | null = null;

export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    // Ao conectar, o cliente recebe o estado atual completo (snapshot).
    const snapshot: WsMessage = {
      type: "snapshot",
      services: listServicesWithHistory(),
    };
    socket.send(JSON.stringify(snapshot));
  });

  return wss;
}

// Envia uma mensagem para todos os clientes conectados.
export function broadcast(message: WsMessage): void {
  if (!wss) return;
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
