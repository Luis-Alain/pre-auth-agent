import { Router } from "express";
import { listSolicitudes } from "../services/notion";
import { processSolicitud } from "../services/pipeline";

export const solicitudesRouter = Router();

// GET /api/solicitudes
solicitudesRouter.get("/solicitudes", async (_req, res) => {
  res.json(await listSolicitudes());
});

// POST /api/solicitudes/:id/process
// Descarga los documentos, extrae sus datos, analiza la solicitud y actualiza Notion.
solicitudesRouter.post("/solicitudes/:id/process", async (req, res) => {
  res.json(await processSolicitud(req.params.id));
});
