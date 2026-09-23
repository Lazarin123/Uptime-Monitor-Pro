import { useEffect, useRef } from "react";
import type { WsMessage } from "../types";

const RECONNECT_DELAY_MS = 2000;

// Mesma ideia do api.ts: em dev, conecta no host atual (proxy do Vite cuida
// do resto). Em produção, se VITE_API_URL estiver definida, conecta direto
// no backend publicado, convertendo http(s) para ws(s).
function resolveWsUrl(): string {
  const apiOrigin = import.meta.env.VITE_API_URL as string | undefined;
  if (apiOrigin) {
    const wsProtocol = apiOrigin.startsWith("https") ? "wss" : "ws";
    const host = apiOrigin.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}/ws`;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

/**
 * Mantém uma conexão WebSocket viva com o backend, reconectando
 * automaticamente se a conexão cair, e repassa cada mensagem recebida
 * para o callback informado.
 */
export function useWebSocket(onMessage: (msg: WsMessage) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    function connect() {
      socket = new WebSocket(resolveWsUrl());

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WsMessage;
          onMessageRef.current(parsed);
        } catch {
          // ignora mensagens malformadas
        }
      };

      socket.onclose = () => {
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
}
