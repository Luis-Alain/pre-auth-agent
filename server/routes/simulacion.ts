import { existsSync } from "node:fs";
import path from "node:path";
import { Router, type Request, type Response } from "express";
import {
  MANUAL_DIR,
  SAMPLE_DIR,
  SCENARIOS,
  crearSimulacionManual,
  crearYProcesarSimulacion,
  limpiarManuales,
  limpiarSimulaciones,
} from "../services/simulacion";

export const simulacionRouter = Router();

const MAX_PROCESOS_POR_VENTANA = 4;
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

function limiteAlcanzado(res: Response, ip: string) {
  const actual = intentos.get(ip);
  const restante = actual ? Math.max(1, Math.ceil((actual.reset - Date.now()) / 1000)) : 300;
  const minutos = Math.floor(restante / 60);
  const segundos = restante % 60;
  const texto = minutos > 0 ? `${minutos} min ${segundos} s` : `${segundos} s`;
  res.setHeader("Retry-After", String(restante));
  res.status(429).json({
    error: `Limite de simulaciones alcanzado para evitar spam. Vuelve a intentarlo en ${texto}.`,
  });
}

simulacionRouter.get("/simulacion/casos", (_req, res) => {
  res.json(SCENARIOS);
});

function servirPdf(ruta: string, res: Response) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${path.basename(ruta)}"`);
  res.sendFile(ruta);
}

simulacionRouter.get("/simulacion/archivos/:nombre", (req, res) => {
  const ruta = path.join(SAMPLE_DIR, path.basename(req.params.nombre));
  if (!existsSync(ruta)) {
    res.status(404).json({ error: "Archivo de simulacion no encontrado." });
    return;
  }
  servirPdf(ruta, res);
});

simulacionRouter.get("/simulacion/manual/archivos/:nombre", (req, res) => {
  const ruta = path.join(MANUAL_DIR, path.basename(req.params.nombre));
  if (!existsSync(ruta)) {
    res.status(404).json({ error: "Archivo manual no encontrado." });
    return;
  }
  servirPdf(ruta, res);
});

function esBotonera(body: unknown): boolean {
  const trampa = (body as { trampa?: unknown } | undefined)?.trampa;
  return typeof trampa === "string" && trampa.trim() !== "";
}

simulacionRouter.post("/simulacion", async (req, res, next) => {
  if (esBotonera(req.body)) {
    res.status(403).json({ error: "Acceso denegado." });
    return;
  }
  const ip = ipDe(req);
  if (!permitido(ip)) {
    limiteAlcanzado(res, ip);
    return;
  }
  try {
    const resultado = await crearYProcesarSimulacion(req.body?.scenario);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

simulacionRouter.post("/simulacion/manual", async (req, res, next) => {
  if (esBotonera(req.body)) {
    res.status(403).json({ error: "Acceso denegado." });
    return;
  }
  const ip = ipDe(req);
  if (!permitido(ip)) {
    limiteAlcanzado(res, ip);
    return;
  }
  try {
    const resultado = await crearSimulacionManual(req.body ?? {});
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

simulacionRouter.delete("/simulacion", async (_req, res, next) => {
  try {
    await limpiarSimulaciones();
    await limpiarManuales();
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
