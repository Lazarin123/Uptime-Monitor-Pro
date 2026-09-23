import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import type { TLSSocket } from "node:tls";
import type { CheckResult, SslInfo } from "./types.js";

const REQUEST_TIMEOUT_MS = 10_000;
const DEGRADED_LATENCY_MS = 2_000; // acima disso, serviço "up" vira "degraded"

// Extrai informações do certificado a partir do socket TLS da resposta.
function extractSslInfo(socket: TLSSocket): SslInfo {
  const cert = socket.getPeerCertificate();
  if (!cert || Object.keys(cert).length === 0) {
    return { valid: false };
  }

  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  const daysUntilExpiry = validTo
    ? Math.round((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  const rawIssuer = cert.issuer?.O ?? cert.issuer?.CN;
  const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] : rawIssuer;

  return {
    valid: socket.authorized === true,
    issuer,
    validFrom: cert.valid_from,
    validTo: cert.valid_to,
    daysUntilExpiry,
  };
}

// Reduz o objeto de headers do Node (que pode ter arrays) para um mapa simples.
function flattenHeaders(
  headers: http.IncomingHttpHeaders
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

/**
 * Executa uma checagem HTTP/HTTPS contra a URL informada, medindo latência
 * de ponta a ponta e, quando aplicável, coletando dados do certificado TLS.
 */
export function checkService(url: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    const timestamp = new Date().toISOString();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve({
        timestamp,
        status: "down",
        error: "URL inválida",
      });
      return;
    }

    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;
    const start = performance.now();

    const req = client.request(
      parsed,
      {
        method: "GET",
        timeout: REQUEST_TIMEOUT_MS,
        headers: { "User-Agent": "uptime-monitor/1.0" },
      },
      (res) => {
        const latencyMs = Math.round(performance.now() - start);
        const httpStatus = res.statusCode ?? 0;
        const headers = flattenHeaders(res.headers);
        const ssl = isHttps
          ? extractSslInfo(res.socket as TLSSocket)
          : undefined;

        // Consome e descarta o corpo para liberar o socket sem medir custo extra.
        res.resume();
        res.on("end", () => {
          let status: CheckResult["status"];
          if (httpStatus >= 200 && httpStatus < 400) {
            status = latencyMs > DEGRADED_LATENCY_MS ? "degraded" : "up";
          } else if (httpStatus >= 400 && httpStatus < 500) {
            status = "degraded";
          } else {
            status = "down";
          }

          resolve({ timestamp, status, httpStatus, latencyMs, headers, ssl });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({
        timestamp,
        status: "down",
        error: `Tempo limite excedido (${REQUEST_TIMEOUT_MS}ms)`,
      });
    });

    req.on("error", (err) => {
      resolve({
        timestamp,
        status: "down",
        error: err.message,
      });
    });

    req.end();
  });
}
