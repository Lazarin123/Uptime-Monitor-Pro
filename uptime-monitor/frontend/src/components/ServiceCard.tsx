import { StatusBadge } from "./StatusBadge";
import { ResponseTimeChart } from "./ResponseTimeChart";
import type { ServiceWithHistory } from "../types";

export function ServiceCard({
  service,
  onRemove,
}: {
  service: ServiceWithHistory;
  onRemove: (id: string) => void;
}) {
  const { lastResult } = service;
  const status = lastResult?.status ?? "pending";
  const ssl = lastResult?.ssl;

  let sslClass = "";
  let sslText: string | null = null;
  if (ssl) {
    if (!ssl.valid) {
      sslClass = "bad";
      sslText = "certificado inválido";
    } else if (typeof ssl.daysUntilExpiry === "number") {
      if (ssl.daysUntilExpiry < 7) {
        sslClass = "bad";
        sslText = `certificado expira em ${ssl.daysUntilExpiry}d`;
      } else if (ssl.daysUntilExpiry < 30) {
        sslClass = "warn";
        sslText = `certificado expira em ${ssl.daysUntilExpiry}d`;
      } else {
        sslText = `certificado válido · expira em ${ssl.daysUntilExpiry}d`;
      }
    }
  }

  return (
    <div className="service-card">
      <div className="service-card-top">
        <div>
          <p className="service-name">{service.name}</p>
          <p className="service-url">{service.url}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="service-metrics">
        <div>
          <div className="metric-label">latência</div>
          <div className="metric-value">
            {lastResult?.latencyMs !== undefined ? `${lastResult.latencyMs}ms` : "—"}
          </div>
        </div>
        <div>
          <div className="metric-label">uptime</div>
          <div className="metric-value">{service.uptimePercent}%</div>
        </div>
        <div>
          <div className="metric-label">status HTTP</div>
          <div className="metric-value">{lastResult?.httpStatus ?? "—"}</div>
        </div>
      </div>

      {lastResult?.error && <div className="error-line">{lastResult.error}</div>}
      {sslText && <div className={`ssl-line ${sslClass}`}>🔒 {sslText}</div>}

      <ResponseTimeChart history={service.history} />

      <div className="service-card-footer">
        <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
          checagem a cada {service.intervalSeconds}s
        </span>
        <button className="remove-btn" onClick={() => onRemove(service.id)}>
          remover
        </button>
      </div>
    </div>
  );
}
