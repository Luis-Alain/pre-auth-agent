import path from "node:path";
import { archivePage, createSolicitudPage, listSolicitudes } from "./notion";
import {
  toSolicitudPreAutorizacionRecord,
  type SolicitudPreAutorizacionPage,
} from "../models/solicitudes";
import { processSolicitud } from "./pipeline";
import { ESTADOS_FINALES } from "../schemas/analysis";

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

export async function crearYProcesarSimulacion(titular?: string) {
  const nombreTitular = titular?.trim() || TITULAR_MUESTRA;

  const page = await createSolicitudPage({
    titular: nombreTitular,
    informeMedico: [
      { nombre: INFORME_MEDICO.nombre, url: archivoUrl(INFORME_MEDICO.archivo) },
    ],
    poliza: [{ nombre: POLIZA.nombre, url: archivoUrl(POLIZA.archivo) }],
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
      s.titular.trim() === TITULAR_MUESTRA.trim() &&
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