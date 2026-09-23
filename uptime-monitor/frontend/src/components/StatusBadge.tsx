import type { ServiceStatus } from "../types";

const LABELS: Record<ServiceStatus, string> = {
  up: "ativo",
  degraded: "degradado",
  down: "inativo",
  pending: "aguardando",
};

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return (
    <span className="status-badge">
      <span className={`status-dot ${status}`} />
      {LABELS[status]}
    </span>
  );
}
