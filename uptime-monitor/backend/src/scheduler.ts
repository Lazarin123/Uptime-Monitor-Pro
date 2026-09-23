import cron from "node-cron";
import { checkService } from "./monitor.js";
import {
  appendCheckResult,
  listRawServices,
  toServiceWithHistory,
} from "./store.js";
import { broadcast } from "./websocket.js";

// Roda a cada 5 segundos (base do "relógio"); cada serviço só é de fato
// checado quando o tempo desde a sua última checagem >= o seu intervalo
// configurado. Isso permite intervalos por serviço sem um cron por serviço.
const TICK_CRON_EXPRESSION = "*/5 * * * * *";

const lastCheckedAt = new Map<string, number>();

async function runDueChecks(): Promise<void> {
  const now = Date.now();
  const due = listRawServices().filter(({ service }) => {
    const last = lastCheckedAt.get(service.id) ?? 0;
    return now - last >= service.intervalSeconds * 1000;
  });

  if (due.length === 0) return;

  // Dispara as checagens concorrentemente (não sequencialmente) para não
  // deixar serviços mais lentos atrasarem a checagem dos demais.
  await Promise.all(
    due.map(async ({ service }) => {
      lastCheckedAt.set(service.id, Date.now());
      const result = await checkService(service.url);
      appendCheckResult(service.id, result);

      const entry = listRawServices().find((e) => e.service.id === service.id);
      if (entry) {
        broadcast({ type: "update", service: toServiceWithHistory(entry) });
      }
    })
  );
}

let task: cron.ScheduledTask | null = null;

export function startScheduler(): void {
  if (task) return;
  task = cron.schedule(TICK_CRON_EXPRESSION, () => {
    void runDueChecks();
  });
}

export function stopScheduler(): void {
  task?.stop();
  task = null;
}

// Força a checagem imediata de um único serviço (usado ao cadastrar um novo).
export async function checkNow(serviceId: string): Promise<void> {
  const entry = listRawServices().find((e) => e.service.id === serviceId);
  if (!entry) return;
  lastCheckedAt.set(serviceId, Date.now());
  const result = await checkService(entry.service.url);
  appendCheckResult(serviceId, result);
  const updated = listRawServices().find((e) => e.service.id === serviceId);
  if (updated) {
    broadcast({ type: "update", service: toServiceWithHistory(updated) });
  }
}
