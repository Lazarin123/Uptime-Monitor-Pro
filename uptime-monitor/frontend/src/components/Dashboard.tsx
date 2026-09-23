import { useServices } from "../hooks/useServices";
import { AddServiceForm } from "./AddServiceForm";
import { ServiceCard } from "./ServiceCard";

export function Dashboard() {
  const { services, loading, connected, addService, removeService } = useServices();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">Uptime Monitor</h1>
          <p className="app-subtitle">
            Checagens periódicas de status, latência e certificado SSL para os
            serviços e APIs que você cadastrar.
          </p>
        </div>
        <span className="connection-pill">
          <span className={`connection-dot ${connected ? "connected" : ""}`} />
          {connected ? "tempo real conectado" : "conectando…"}
        </span>
      </header>

      <AddServiceForm onAdd={addService} />

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Carregando serviços…</p>
      ) : services.length === 0 ? (
        <div className="empty-state">
          <strong>Nenhum serviço monitorado ainda</strong>
          Adicione uma URL acima para começar a receber checagens automáticas.
        </div>
      ) : (
        <div className="service-grid">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} onRemove={removeService} />
          ))}
        </div>
      )}
    </div>
  );
}
