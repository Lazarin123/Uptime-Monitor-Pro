export type ServiceStatus = "up" | "degraded" | "down" | "pending";

export interface SslInfo {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
}

export interface CheckResult {
  timestamp: string;
  status: ServiceStatus;
  httpStatus?: number;
  latencyMs?: number;
  error?: string;
  headers?: Record<string, string>;
  ssl?: SslInfo;
}

export interface MonitoredService {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  createdAt: string;
}

export interface ServiceWithHistory extends MonitoredService {
  history: CheckResult[];
  lastResult: CheckResult | null;
  uptimePercent: number;
  avgLatencyMs: number | null;
}

export interface CreateServiceInput {
  name: string;
  url: string;
  intervalSeconds?: number;
}

export type WsMessage =
  | { type: "snapshot"; services: ServiceWithHistory[] }
  | { type: "update"; service: ServiceWithHistory }
  | { type: "removed"; id: string };
