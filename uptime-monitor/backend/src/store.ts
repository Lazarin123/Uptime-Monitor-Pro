import { randomUUID } from "node:crypto";
import type {
  CheckResult,
  CreateServiceInput,
  MonitoredService,
  ServiceWithHistory,
} from "./types.js";

// Quantidade máxima de checagens guardadas por serviço (janela deslizante).
// Em memória de propósito: o enunciado pede persistência em memória durante
// a sessão do servidor (alternativa ao localStorage no cliente).
const MAX_HISTORY = 60;
const DEFAULT_INTERVAL_SECONDS = Number(
  process.env.DEFAULT_CHECK_INTERVAL_SECONDS ?? 15
);

interface StoredService {
  service: MonitoredService;
  history: CheckResult[];
}

const services = new Map<string, StoredService>();

export function createService(input: CreateServiceInput): MonitoredService {
  const service: MonitoredService = {
    id: randomUUID(),
    name: input.name.trim(),
    url: input.url.trim(),
    intervalSeconds: input.intervalSeconds ?? DEFAULT_INTERVAL_SECONDS,
    createdAt: new Date().toISOString(),
  };
  services.set(service.id, { service, history: [] });
  return service;
}

export function removeService(id: string): boolean {
  return services.delete(id);
}

export function getRawService(id: string): StoredService | undefined {
  return services.get(id);
}

export function listRawServices(): StoredService[] {
  return Array.from(services.values());
}

export function appendCheckResult(id: string, result: CheckResult): void {
  const entry = services.get(id);
  if (!entry) return;
  entry.history.push(result);
  if (entry.history.length > MAX_HISTORY) {
    entry.history.shift();
  }
}

function computeUptimePercent(history: CheckResult[]): number {
  if (history.length === 0) return 100;
  const healthy = history.filter((h) => h.status === "up").length;
  return Math.round((healthy / history.length) * 1000) / 10; // 1 casa decimal
}

function computeAvgLatency(history: CheckResult[]): number | null {
  const withLatency = history.filter(
    (h) => typeof h.latencyMs === "number" && h.status !== "down"
  );
  if (withLatency.length === 0) return null;
  const sum = withLatency.reduce((acc, h) => acc + (h.latencyMs ?? 0), 0);
  return Math.round(sum / withLatency.length);
}

export function toServiceWithHistory(entry: StoredService): ServiceWithHistory {
  const { service, history } = entry;
  return {
    ...service,
    history,
    lastResult: history.length > 0 ? history[history.length - 1] : null,
    uptimePercent: computeUptimePercent(history),
    avgLatencyMs: computeAvgLatency(history),
  };
}

export function listServicesWithHistory(): ServiceWithHistory[] {
  return listRawServices()
    .map(toServiceWithHistory)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getServiceWithHistory(
  id: string
): ServiceWithHistory | undefined {
  const entry = getRawService(id);
  return entry ? toServiceWithHistory(entry) : undefined;
}
