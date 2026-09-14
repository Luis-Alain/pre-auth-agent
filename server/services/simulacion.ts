import path from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { archivePage, createSolicitudPage, listSolicitudes } from "./notion";
import {
  toSolicitudPreAutorizacionRecord,
  type SolicitudPreAutorizacionPage,
} from "../models/solicitudes";
import { processSolicitud, HttpError } from "./pipeline";
import { puedeLimpiar } from "./cleanup";

export const SAMPLE_DIR = path.join(import.meta.dir, "..", "data", "sample");
export const MANUAL_DIR = path.join(import.meta.dir, "..", "data", "manual");

export interface Scenario {
  id: string;
  titular: string;
  descripcion: string;
  archivos: { nombre: string; archivo: string }[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "aprobada",
    titular: "Jose Manuel Camarena Castano",
    descripcion: "Hernia inguinal sintomatica - procedimiento cubierto por la poliza",
    archivos: [
      { nombre: "informe_medico_jose_camarena.pdf", archivo: "informe-medico-aprobado.pdf" },
      { nombre: "poliza_jose_camarena.pdf", archivo: "poliza.pdf" },
    ],
  },
  {
    id: "rechazada",
    titular: "Roberto Carlos Mendez Herrera",
    descripcion: "Rinoplastia estetica - procedimiento excluido por la poliza",
    archivos: [
      { nombre: "informe_medico_roberto_mendez.pdf", archivo: "informe-medico-rechazado.pdf" },
      { nombre: "poliza_roberto_mendez.pdf", archivo: "poliza.pdf" },
    ],
  },
  {
    id: "documentos-faltantes",
    titular: "Ana Lucia Paredes Cardenas",
    descripcion: "Informe medico incompleto - falta diagnostico y justificacion",
    archivos: [
      { nombre: "informe_medico_ana_paredes.pdf", archivo: "informe-medico-incompleto.pdf" },
      { nombre: "poliza_ana_paredes.pdf", archivo: "poliza.pdf" },
    ],
  },
];

const TITULARES_SIMULACION = new Set(SCENARIOS.map((s) => s.titular));

const FILE_BASE_URL =
  process.env.FILE_BASE_URL ??
  process.env.CLIENT_ORIGIN ??
  "http://localhost:3000";

const archivoUrl = (archivo: string) =>
  `${FILE_BASE_URL}/api/simulacion/archivos/${archivo}`;

const archivoManualUrl = (nombre: string) =>
  `${FILE_BASE_URL}/api/simulacion/manual/archivos/${nombre}`;

export async function crearYProcesarSimulacion(scenarioId: string) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0]!;

  const page = await createSolicitudPage({
    titular: scenario.titular,
    informeMedico: scenario.archivos
      .filter((a) => a.archivo.includes("informe"))
      .map((a) => ({ nombre: a.nombre, url: archivoUrl(a.archivo) })),
    poliza: scenario.archivos
      .filter((a) => a.archivo.includes("poliza"))
      .map((a) => ({ nombre: a.nombre, url: archivoUrl(a.archivo) })),
  });

  const procesado = await processSolicitud(page.id);
  return {
    ...procesado,
    solicitud: toSolicitudPreAutorizacionRecord(
      page as unknown as SolicitudPreAutorizacionPage,
    ),
  };
}

interface Subida {
  nombre: string;
  contenido: string;
}

const manualesActivas = new Map<string, { titular: string; archivos: string[] }>();

function nombreManual(base: string): string {
  const limpio = base.replace(/[^\w.\-]/g, "_").replace(/\.pdf$/i, "");
  return `manual_${Date.now()}_${limpio}.pdf`;
}

export async function crearSimulacionManual(input: {
  titular: string;
  informe?: Subida;
  poliza?: Subida;
}) {
  const titular = input.titular?.trim();
  if (!titular) throw new HttpError(400, "El nombre del titular es requerido.");
  if (!input.informe?.contenido || !input.poliza?.contenido) {
    throw new HttpError(400, "Se requieren el informe medico y la poliza en PDF.");
  }

  await mkdir(MANUAL_DIR, { recursive: true });

  const informeNombre = nombreManual(input.informe.nombre || "informe.pdf");
  const polizaNombre = nombreManual(input.poliza.nombre || "poliza.pdf");

  const informeBuffer = Buffer.from(input.informe.contenido, "base64");
  const polizaBuffer = Buffer.from(input.poliza.contenido, "base64");
  if (
    informeBuffer.subarray(0, 4).toString() !== "%PDF" ||
    polizaBuffer.subarray(0, 4).toString() !== "%PDF"
  ) {
    throw new HttpError(400, "Los archivos deben ser PDF validos.");
  }
  await writeFile(path.join(MANUAL_DIR, informeNombre), informeBuffer);
  await writeFile(path.join(MANUAL_DIR, polizaNombre), polizaBuffer);

  const page = await createSolicitudPage({
    titular,
    informeMedico: [
      { nombre: input.informe.nombre || informeNombre, url: archivoManualUrl(informeNombre) },
    ],
    poliza: [
      { nombre: input.poliza.nombre || polizaNombre, url: archivoManualUrl(polizaNombre) },
    ],
  });
  manualesActivas.set(page.id, { titular, archivos: [informeNombre, polizaNombre] });

  const procesado = await processSolicitud(page.id);
  return {
    ...procesado,
    solicitud: toSolicitudPreAutorizacionRecord(
      page as unknown as SolicitudPreAutorizacionPage,
    ),
  };
}

async function archivarFinalizadas(titulares: Set<string>, soloExpiradas: boolean): Promise<number> {
  const todas = await listSolicitudes();
  const objetivo = todas.filter(
    (s) =>
      titulares.has(s.titular.trim()) &&
      puedeLimpiar(s, soloExpiradas),
  );
  await Promise.all(objetivo.map((s) => archivePage(s.id)));
  return objetivo.length;
}

export async function limpiarSimulaciones(soloExpiradas = false): Promise<number> {
  return archivarFinalizadas(TITULARES_SIMULACION, soloExpiradas);
}

export async function limpiarManuales(soloExpiradas = false): Promise<number> {
  if (!manualesActivas.size) return 0;
  const todas = await listSolicitudes();
  let limpiadas = 0;
  for (const [id, manual] of manualesActivas) {
    const solicitud = todas.find((s) => s.id === id);
    if (solicitud && !puedeLimpiar(solicitud, soloExpiradas)) continue;
    if (solicitud) await archivePage(id);
    for (const archivo of manual.archivos) {
      await rm(path.join(MANUAL_DIR, archivo), { force: true }).catch(() => undefined);
    }
    manualesActivas.delete(id);
    limpiadas++;
  }
  return limpiadas;
}

function limpiarPeriodica() {
  void limpiarSimulaciones(true).catch((error) =>
    console.error("Limpieza periodica de simulaciones fallo:", error),
  );
  void limpiarManuales(true).catch((error) =>
    console.error("Limpieza periodica de manuales fallo:", error),
  );
}

setInterval(limpiarPeriodica, 30_000);
