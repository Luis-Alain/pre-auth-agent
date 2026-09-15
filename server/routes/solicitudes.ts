import { Router } from "express";
import { getTablaUrl, listSolicitudes } from "../services/notion";
import { HttpError, limpiarSolicitud, processSolicitud } from "../services/pipeline";

export const solicitudesRouter = Router();

// GET /api/solicitudes
solicitudesRouter.get("/solicitudes", async (_req, res) => {
  res.json(await listSolicitudes());
});

// GET /api/solicitudes/tabla
solicitudesRouter.get("/solicitudes/tabla", async (_req, res) => {
  res.json({ url: await getTablaUrl() });
});

// POST /api/solicitudes/:id/process
// Responde en NDJSON: un evento { paso } por etapa y al final { resultado } o { error }.
solicitudesRouter.post("/solicitudes/:id/process", async (req, res) => {
  const enviar = (evento: object) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/x-ndjson");
    res.write(`${JSON.stringify(evento)}\n`);
  };

  try {
    const resultado = await processSolicitud(req.params.id, (paso) => enviar({ paso }));
    enviar({ resultado });
    res.end();
  } catch (error) {
    // Sin eventos enviados aún, el errorHandler responde con el código real (404, 409...).
    if (!res.headersSent) throw error;
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error(error);
    enviar({ error: error instanceof Error ? error.message : "Error interno del servidor." });
    res.end();
  }
});

// POST /api/solicitudes/:id/limpiar
// Reinicia la solicitud para volver a procesarla: Status "En revision" y Respuesta vacía.
solicitudesRouter.post("/solicitudes/:id/limpiar", async (req, res) => {
  await limpiarSolicitud(req.params.id);
  res.json({ status: "En revision", respuesta: "" });
});
