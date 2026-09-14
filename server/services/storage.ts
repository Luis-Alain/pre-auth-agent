import { rm } from "node:fs/promises";
import path from "node:path";
import type { Solicitud } from "./notion";

export const SOLICITUDES_DIR = path.join(
  import.meta.dir,
  "..",
  "solicitudes-pdf",
);

const MIME_POR_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const EXTENSION_POR_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export interface DocumentoLocal {
  nombre: string;
  ruta: string;
  mimeType: string;
}

export interface DocumentosDescargados {
  informeMedico: DocumentoLocal[];
  poliza: DocumentoLocal[];
}

export function folderFor(numero: number): string {
  return `solicitud-${String(numero).padStart(2, "0")}`;
}

export function fileBaseName(base: string, index: number): string {
  return index === 0 ? base : `${base}-${index + 1}`;
}

export function metaFor(solicitud: Solicitud) {
  return {
    notionPageId: solicitud.id,
    titular: solicitud.titular,
    notionUrl: solicitud.url,
    createdTime: solicitud.createdTime,
    numero: solicitud.numero,
  };
}

export async function writeJson(
  carpeta: string,
  nombre: string,
  data: unknown,
) {
  await Bun.write(
    path.join(SOLICITUDES_DIR, carpeta, nombre),
    JSON.stringify(data, null, 2),
  );
}

async function descargar(
  archivo: { nombre: string; url: string },
  destinoSinExtension: string,
): Promise<DocumentoLocal> {
  const response = await fetch(archivo.url);
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar "${archivo.nombre}" (HTTP ${response.status}).`,
    );
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  const mimeType =
    MIME_POR_EXTENSION[path.extname(archivo.nombre).toLowerCase()] ??
    (EXTENSION_POR_MIME[contentType] ? contentType : undefined);
  if (!mimeType) {
    throw new Error(
      `Formato no soportado para "${archivo.nombre}". Se aceptan PDF o imágenes.`,
    );
  }

  const ruta = `${destinoSinExtension}${EXTENSION_POR_MIME[mimeType]}`;
  await Bun.write(ruta, response);
  return { nombre: archivo.nombre, ruta, mimeType };
}

export async function downloadDocuments(
  solicitud: Solicitud,
): Promise<DocumentosDescargados> {
  const carpeta = folderFor(solicitud.numero);
  const dir = path.join(SOLICITUDES_DIR, carpeta);
  await rm(dir, { recursive: true, force: true });

  const [informeMedico, poliza] = await Promise.all([
    Promise.all(
      solicitud.informeMedico.map((archivo, i) =>
        descargar(archivo, path.join(dir, fileBaseName("informe-medico", i))),
      ),
    ),
    Promise.all(
      solicitud.poliza.map((archivo, i) =>
        descargar(archivo, path.join(dir, fileBaseName("poliza", i))),
      ),
    ),
  ]);

  await writeJson(carpeta, "meta.json", metaFor(solicitud));
  return { informeMedico, poliza };
}

export async function eliminarArchivosSolicitud(carpeta: string): Promise<void> {
  await rm(path.join(SOLICITUDES_DIR, carpeta), { recursive: true, force: true }).catch(
    (error) => console.error(`No se pudieron eliminar los archivos locales de ${carpeta}:`, error),
  );
}
