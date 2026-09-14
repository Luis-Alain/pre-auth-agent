import path from "node:path";
import { archivePage, createSolicitudPage, listSolicitudes } from "./notion";
import {
  toSolicitudPreAutorizacionRecord,
  type SolicitudPreAutorizacionPage,
} from "../models/solicitudes";
import { processSolicitud } from "./pipeline";
import { ESTADOS_FINALES } from "../schemas/analysis";

export const SAMPLE_DIR = path.join(import.meta.dir, "..", "data", "sample");

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

export async function limpiarSimulaciones(): Promise<number> {
  const todas = await listSolicitudes();
  const objetivo = todas.filter(
    (s) =>
      TITULARES_SIMULACION.has(s.titular.trim()) &&
      s.status !== null &&
      (ESTADOS_FINALES as readonly string[]).includes(s.status),
  );
  await Promise.allSettled(
    objetivo.map((s) =>
      archivePage(s.id).catch((error) => {
        console.error("No se pudo eliminar la solicitud de simulacion:", error);
      }),
    ),
  );
  return objetivo.length;
}

setInterval(() => {
  void limpiarSimulaciones().catch((error) =>
    console.error("Limpieza periodica de simulaciones fallo:", error),
  );
}, 30_000);
