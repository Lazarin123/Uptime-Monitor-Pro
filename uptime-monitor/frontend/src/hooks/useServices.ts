import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useWebSocket } from "./useWebSocket";
import type { CreateServiceInput, ServiceWithHistory, WsMessage } from "../types";

const LOCAL_CACHE_KEY = "uptime-monitor:last-snapshot";

export function useServices() {
  const [services, setServices] = useState<ServiceWithHistory[]>(() => {
    // Cache leve no navegador: evita a tela vazia por um instante ao recarregar
    // a página, antes da resposta do servidor chegar.
    try {
      const cached = localStorage.getItem(LOCAL_CACHE_KEY);
      return cached ? (JSON.parse(cached) as ServiceWithHistory[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api
      .list()
      .then(setServices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(services));
    } catch {
      // localStorage pode falhar (modo privado, cota excedida) — não é crítico
    }
  }, [services]);

  const handleMessage = useCallback((msg: WsMessage) => {
    setConnected(true);
    if (msg.type === "snapshot") {
      setServices(msg.services);
    } else if (msg.type === "update") {
      setServices((prev) => {
        const exists = prev.some((s) => s.id === msg.service.id);
        return exists
          ? prev.map((s) => (s.id === msg.service.id ? msg.service : s))
          : [...prev, msg.service];
      });
    } else if (msg.type === "removed") {
      setServices((prev) => prev.filter((s) => s.id !== msg.id));
    }
  }, []);

  useWebSocket(handleMessage);

  const addService = useCallback(async (input: CreateServiceInput) => {
    const created = await api.create(input);
    setServices((prev) => [...prev, { ...created, history: [], lastResult: null, uptimePercent: 100, avgLatencyMs: null }]);
  }, []);

  const removeService = useCallback(async (id: string) => {
    await api.remove(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const sorted = useMemo(
    () => [...services].sort((a, b) => a.name.localeCompare(b.name)),
    [services]
  );

  return { services: sorted, loading, error, connected, addService, removeService };
}
