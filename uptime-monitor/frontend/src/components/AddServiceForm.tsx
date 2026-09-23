import { useState, type FormEvent } from "react";
import type { CreateServiceInput } from "../types";

const INTERVAL_OPTIONS = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
];

export function AddServiceForm({
  onAdd,
}: {
  onAdd: (input: CreateServiceInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onAdd({ name, url, intervalSeconds: interval });
      setName("");
      setUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao adicionar serviço");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input
        placeholder="Nome (ex: API de Pagamentos)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        placeholder="https://exemplo.com/health"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        type="url"
        required
      />
      <select value={interval} onChange={(e) => setInterval(Number(e.target.value))}>
        {INTERVAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            a cada {opt.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "adicionando…" : "monitorar"}
      </button>
      {error && <div className="form-error">{error}</div>}
    </form>
  );
}
