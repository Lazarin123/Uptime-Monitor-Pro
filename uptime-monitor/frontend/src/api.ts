import type { CreateServiceInput, ServiceWithHistory } from "./types";

// Em dev, o Vite faz proxy de /api para o backend (ver vite.config.ts), então
// um caminho relativo basta. Em produção — front e back em hosts separados,
// como front na Vercel e back no Render/Railway — defina VITE_API_URL com a
// URL completa do backend (ex: https://uptime-monitor-api.onrender.com).
const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE_URL = `${API_ORIGIN}/api/services`;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  list: (): Promise<ServiceWithHistory[]> =>
    fetch(BASE_URL).then((r) => handle(r)),

  create: (input: CreateServiceInput): Promise<ServiceWithHistory> =>
    fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => handle(r)),

  remove: (id: string): Promise<void> =>
    fetch(`${BASE_URL}/${id}`, { method: "DELETE" }).then((r) => handle(r)),
};
