import { existsSync } from "node:fs";
import path from "node:path";
import { Router, type Request } from "express";
import { SAMPLE_DIR, SCENARIOS, crearYProcesarSimulacion, limpiarSimulaciones } from "../services/simulacion";

export const simulacionRouter = Router();

const MAX_PROCESOS_POR_VENTANA = 2;
const VENTANA_MS = 5 * 60 * 1000;

const intentos = new Map<string, { cuenta: number; reset: number }>();

function ipDe(req: Request): string {
  const reenviado = req.headers["x-forwarded-for"];
  if (typeof reenviado === "string") {
    return reenviado.split(",")[0]!.trim();
  }
  return req.socket.remoteAddress ?? "desconocida";
}

function permitido(ip: string): boolean {
  const ahora = Date.now();
  const actual = intentos.get(ip);
  if (!actual || ahora > actual.reset) {
    intentos.set(ip, { cuenta: 1, reset: ahora + VENTANA_MS });
    return true;
  }
  actual.cuenta += 1;
  return actual.cuenta <= MAX_PROCESOS_POR_VENTANA;
}

simulacionRouter.get("/simulacion/casos", (_req, res) => {
  res.json(SCENARIOS);
});

simulacionRouter.get("/simulacion/archivos/:nombre", (req, res) => {
  const ruta = path.join(SAMPLE_DIR, path.basename(req.params.nombre));
  if (!existsSync(ruta)) {
    res.status(404).json({ error: "Archivo de simulacion no encontrado." });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(ruta)}"`);
  res.sendFile(ruta);
});

simulacionRouter.post("/simulacion", async (req, res, next) => {
  const ip = ipDe(req);
  if (!permitido(ip)) {
    res
      .status(429)
      .json({ error: "Demasiadas simulaciones. Espera unos minutos para evitar gasto innecesario de la IA." });
    return;
  }
  try {
    const resultado = await crearYProcesarSimulacion(req.body?.scenario);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

simulacionRouter.delete("/simulacion", async (_req, res, next) => {
  try {
    await limpiarSimulaciones();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
