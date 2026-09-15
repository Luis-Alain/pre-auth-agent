import { APIErrorCode, isNotionClientError } from "@notionhq/client";
import { EXTRACTION_MODEL, extractDocuments } from "../middlewares/extractor";
import type { Analisis } from "../schemas/analysis";
import { ANALYSIS_MODEL, analyzeSolicitud } from "./ai";
import {
  listSolicitudes,
  updateSolicitudResult,
  updateSolicitudStatus,
  type Solicitud,
  type StatusSolicitud,
} from "./notion";
import {
  downloadDocuments,
  eliminarArchivosSolicitud,
  folderFor,
  metaFor,
  writeJson,
} from "./storage";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export interface ResultadoProceso {
  carpeta: string;
  status: StatusSolicitud;
  respuesta: string;
  analisis: Analisis | null;
}

export type PasoProceso =
  | "descarga"
  | "extracción"
  | "análisis"
  | "actualización en Notion";

const enProceso = new Set<string>();

const normalizarId = (id: string) => id.replaceAll("-", "");

export function documentosFaltantes(solicitud: Solicitud): string[] {
  const faltantes: string[] = [];
  if (solicitud.informeMedico.length === 0)
    faltantes.push("Falta el informe médico");
  if (solicitud.poliza.length === 0) faltantes.push("Falta la póliza");
  return faltantes;
}

export function formatRespuesta(analisis: Analisis): string {
  const lineas = [
    `Resultado: ${analisis.status}`,
    `Cobertura: ${analisis.cobertura.razon}`,
    `Período de carencia: ${analisis.periodoCarencia.razon}`,
  ];
  if (analisis.documentosFaltantes.length > 0) {
    lineas.push(
      `Documentos faltantes: ${analisis.documentosFaltantes.join("; ")}`,
    );
  }
  lineas.push(`Justificación: ${analisis.justificacion}`);
  return lineas.join("\n");
}

export async function processSolicitud(
  id: string,
  onPaso?: (paso: PasoProceso) => void,
): Promise<ResultadoProceso> {
  const key = normalizarId(id);
  if (enProceso.has(key)) {
    throw new HttpError(409, "La solicitud ya se está procesando.");
  }

  enProceso.add(key);
  try {
    return await run(key, onPaso);
  } finally {
    enProceso.delete(key);
  }
}

export async function limpiarSolicitud(id: string): Promise<void> {
  const key = normalizarId(id);
  if (enProceso.has(key)) {
    throw new HttpError(409, "La solicitud se está procesando; espera a que termine.");
  }
  // Un id mal formado provoca validation_error en Notion, que no distinguiríamos de otros fallos de validación.
  if (!/^[0-9a-f]{32}$/i.test(key)) {
    throw new HttpError(404, "Solicitud no encontrada.");
  }

  try {
    await updateSolicitudResult(id, "En revision", "");
  } catch (error) {
    if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
      throw new HttpError(404, "Solicitud no encontrada.", { cause: error });
    }
    throw error;
  }
}

async function run(
  id: string,
  onPaso?: (paso: PasoProceso) => void,
): Promise<ResultadoProceso> {
  const solicitud = (await listSolicitudes()).find(
    (s) => normalizarId(s.id) === id,
  );
  if (!solicitud) {
    throw new HttpError(404, "Solicitud no encontrada.");
  }

  const carpeta = folderFor(solicitud.numero);

  const faltantes = documentosFaltantes(solicitud);
  if (faltantes.length > 0) {
    const respuesta = `Resultado: Documentos Faltantes\n${faltantes.join("\n")}`;
    await updateSolicitudResult(
      solicitud.id,
      "Documentos Faltantes",
      respuesta,
    );
    return {
      carpeta,
      status: "Documentos Faltantes",
      respuesta,
      analisis: null,
    };
  }

  const statusAnterior = solicitud.status;
  await updateSolicitudStatus(solicitud.id, "En revision");

  let paso: PasoProceso = "descarga";
  const avanzar = (siguiente: PasoProceso) => {
    paso = siguiente;
    onPaso?.(siguiente);
  };
  try {
    avanzar("descarga");
    const documentos = await downloadDocuments(solicitud);

    avanzar("extracción");
    const { informeMedico, poliza } = await extractDocuments(documentos);
    await writeJson(carpeta, "extraccion.json", {
      meta: metaFor(solicitud),
      modelo: EXTRACTION_MODEL,
      extraidoEn: new Date().toISOString(),
      informeMedico,
      poliza,
    });

    avanzar("análisis");
    const analisis = await analyzeSolicitud({
      fechaSolicitud: solicitud.createdTime.slice(0, 10),
      informeMedico,
      poliza,
    });
    await writeJson(carpeta, "analisis.json", {
      modelo: ANALYSIS_MODEL,
      analizadoEn: new Date().toISOString(),
      ...analisis,
    });

    avanzar("actualización en Notion");
    const respuesta = formatRespuesta(analisis);
    await updateSolicitudResult(solicitud.id, analisis.status, respuesta);

    return { carpeta, status: analisis.status, respuesta, analisis };
  } catch (error) {
    await updateSolicitudStatus(solicitud.id, statusAnterior).catch(
      (restoreError) =>
        console.error(
          "No se pudo restaurar el Status en Notion:",
          restoreError,
        ),
    );
    const detalle = error instanceof Error ? error.message : String(error);
    throw new HttpError(500, `Falló el paso "${paso}": ${detalle}`, {
      cause: error,
    });
  } finally {
    await eliminarArchivosSolicitud(carpeta);
  }
}
