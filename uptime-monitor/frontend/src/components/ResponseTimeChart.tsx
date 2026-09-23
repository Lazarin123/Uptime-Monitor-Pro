import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { CheckResult } from "../types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ResponseTimeChart({ history }: { history: CheckResult[] }) {
  const data = history.map((h) => ({
    time: formatTime(h.timestamp),
    latency: h.latencyMs ?? null,
  }));

  if (data.length < 2) {
    return (
      <div className="chart-wrap" style={{ display: "flex", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Coletando amostras para o gráfico…
        </span>
      </div>
    );
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            formatter={(value: number) => [`${value} ms`, "latência"]}
          />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="var(--accent)"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
