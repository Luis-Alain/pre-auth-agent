import path from "node:path";
import { createSolicitudPage, archivePage } from "./notion";
import {
  toSolicitudPreAutorizacionRecord,
  type SolicitudPreAutorizacionPage,
} from "../models/solicitudes";
import { processSolicitud } from "./pipeline";

export const SAMPLE_DIR = path.join(import.meta.dir, "..", "data", "sample");

export const TITULAR_MUESTRA = "Jose Manuel Camarena Castano";

const INFORME_MEDICO = {
  nombre: "informe_medico_jose_camarena.pdf",
  archivo: "informe-medico.pdf",
};

const POLIZA = {
  nombre: "poliza_jose_camarena.pdf",
  archivo: "poliza.pdf",
};

const FILE_BASE_URL =
  process.env.FILE_BASE_URL ??
  process.env.CLIENT_ORIGIN ??
  "http://localhost:3000";

const archivoUrl = (archivo: string) =>
  `${FILE_BASE_URL}/api/simulacion/archivos/${archivo}`;

interface Registro {
  id: string;
  expiraEn: number;
}

const SIMULACION_TTL_MS = 5 * 60 * 1000;

// ponytail: registro en memoria del proceso; si el servidor se reinicia,
// las filas anteriores quedan en Notion sin limpiar (caso libre ~ok para demo).
const activas = new Map<string, Registro>();

export function registrarSimulacion(id: string) {
  activas.set(id, { id, expiraEn: Date.now() + SIMULACION_TTL_MS });
}

export function esSimulacion(id: string): boolean {
  return activas.has(id);
}

export async function limpiarSimulacion(id: string): Promise<boolean> {
  if (!activas.has(id)) return false;
  await archivePage(id).catch((error) => {
    console.error("No se pudo eliminar la solicitud de simulacion en Notion:", error);
  });
  activas.delete(id);
  return true;
}

export async function crearYProcesarSimulacion(titular?: string) {
  const nombreTitular = titular?.trim() || TITULAR_MUESTRA;

  const page = await createSolicitudPage({
    titular: nombreTitular,
    informeMedico: [
      { nombre: INFORME_MEDICO.nombre, url: archivoUrl(INFORME_MEDICO.archivo) },
    ],
    poliza: [{ nombre: POLIZA.nombre, url: archivoUrl(POLIZA.archivo) }],
  });

  registrarSimulacion(page.id);

  const procesado = await processSolicitud(page.id);
  return {
    ...procesado,
    solicitud: toSolicitudPreAutorizacionRecord(
      page as unknown as SolicitudPreAutorizacionPage,
    ),
  };
}

export function limpiarExpiradas() {
  const now = Date.now();
  for (const [id, registro] of activas) {
    if (registro.expiraEn <= now) {
      void limpiarSimulacion(id).catch(() => undefined);
    }
  }
}

setInterval(limpiarExpiradas, 30_000);