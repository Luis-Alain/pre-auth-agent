import { Router } from "express";
import { getSolicitud } from "../services/notion";
import { HttpError } from "../services/pipeline";

export const documentosRouter = Router();

const TIPOS = {
  "informe-medico": "informeMedico",
  poliza: "poliza",
} as const;

type TipoDocumento = keyof typeof TIPOS;

const esTipoDocumento = (tipo: string): tipo is TipoDocumento =>
  Object.hasOwn(TIPOS, tipo);

// GET /api/solicitudes/:id/documentos/:tipo/:indice
// Los archivos se reenvían desde memoria: nunca se escriben en disco.
documentosRouter.get(
  "/solicitudes/:id/documentos/:tipo/:indice",
  async (req, res) => {
    const { id, tipo, indice } = req.params;

    if (!esTipoDocumento(tipo)) {
      throw new HttpError(400, "Tipo de documento inválido.");
    }
    if (!/^\d+$/.test(indice)) {
      throw new HttpError(400, "Índice de documento inválido.");
    }

    const solicitud = await getSolicitud(id);
    if (!solicitud) {
      throw new HttpError(404, "Solicitud no encontrada.");
    }

    const archivo = solicitud[TIPOS[tipo]][Number(indice)];
    if (!archivo) {
      throw new HttpError(404, "Documento no encontrado.");
    }

    let upstream: Response;
    try {
      upstream = await fetch(archivo.url);
    } catch (error) {
      throw new HttpError(502, "No se pudo descargar el documento.", {
        cause: error,
      });
    }
    if (!upstream.ok) {
      throw new HttpError(
        502,
        `No se pudo descargar el documento (HTTP ${upstream.status}).`,
      );
    }

    const contenido = Buffer.from(await upstream.arrayBuffer());
    res.attachment(archivo.nombre);
    res.type(upstream.headers.get("content-type") ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.send(contenido);
  },
);
