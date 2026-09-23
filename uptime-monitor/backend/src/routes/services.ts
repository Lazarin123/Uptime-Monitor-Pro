import { Router, type Request, type Response } from "express";
import {
  createService,
  getServiceWithHistory,
  listServicesWithHistory,
  removeService,
} from "../store.js";
import { checkNow } from "../scheduler.js";
import { broadcast } from "../websocket.js";
import type { CreateServiceInput } from "../types.js";

export const servicesRouter = Router();

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

servicesRouter.get("/", (_req: Request, res: Response) => {
  res.json(listServicesWithHistory());
});

servicesRouter.get("/:id", (req: Request, res: Response) => {
  const service = getServiceWithHistory(req.params.id);
  if (!service) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }
  res.json(service);
});

servicesRouter.post("/", (req: Request, res: Response) => {
  const body = req.body as Partial<CreateServiceInput>;

  if (!body.name || !body.name.trim()) {
    res.status(400).json({ error: "O campo 'name' é obrigatório" });
    return;
  }
  if (!body.url || !isValidUrl(body.url)) {
    res
      .status(400)
      .json({ error: "O campo 'url' deve ser uma URL http(s) válida" });
    return;
  }
  if (
    body.intervalSeconds !== undefined &&
    (typeof body.intervalSeconds !== "number" || body.intervalSeconds < 5)
  ) {
    res
      .status(400)
      .json({ error: "'intervalSeconds' deve ser um número >= 5" });
    return;
  }

  const service = createService({
    name: body.name,
    url: body.url,
    intervalSeconds: body.intervalSeconds,
  });

  res.status(201).json(service);

  // Checagem imediata em segundo plano para o card não ficar "pending" à toa.
  void checkNow(service.id);
});

servicesRouter.delete("/:id", (req: Request, res: Response) => {
  const removed = removeService(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }
  broadcast({ type: "removed", id: req.params.id });
  res.status(204).send();
});
