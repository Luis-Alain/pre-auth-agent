import { Client, isFullPage } from "@notionhq/client";
import {
  toSolicitudPreAutorizacionRecord,
  type SolicitudPreAutorizacionPage,
  type SolicitudPreAutorizacionRecord,
} from "../models/solicitudes";
import type { EstadoFinal } from "../schemas/analysis";
import { chunkRichText } from "./richText";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const DATA_SOURCE_ID =
  process.env.NOTION_DATA_SOURCE_ID ?? "3da129e1-a3ac-806d-b0ec-000bbf3841f6";

export const STATUS_INICIAL = "En revision";

export type StatusSolicitud = "En revision" | EstadoFinal;

export interface Solicitud extends SolicitudPreAutorizacionRecord {
  numero: number;
}

export async function listSolicitudes(): Promise<Solicitud[]> {
  const pages: SolicitudPreAutorizacionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      page_size: 100,
      start_cursor: cursor,
    });

    for (const result of response.results) {
      if (isFullPage(result)) {
        pages.push(result as unknown as SolicitudPreAutorizacionPage);
      }
    }
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return pages.map((page, index) => ({
    ...toSolicitudPreAutorizacionRecord(page),
    numero: index + 1,
  }));
}

export async function updateSolicitudStatus(
  pageId: string,
  status: string | null,
) {
  await notion.pages.update({
    page_id: pageId,
    properties: { Status: { status: status ? { name: status } : null } },
  });
}

export async function updateSolicitudResult(
  pageId: string,
  status: StatusSolicitud,
  respuesta: string,
) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { status: { name: status } },
      Respuesta: { rich_text: chunkRichText(respuesta) },
    },
  });
}

interface ArchivoExterno {
  nombre: string;
  url: string;
}

export async function createSolicitudPage(input: {
  titular: string;
  informeMedico: ArchivoExterno[];
  poliza: ArchivoExterno[];
}): Promise<SolicitudPreAutorizacionPage> {
  const response = await notion.pages.create({
    parent: { data_source_id: DATA_SOURCE_ID },
    properties: {
      Titular: { title: [{ type: "text", text: { content: input.titular } }] },
      "Informe Medico": {
        files: input.informeMedico.map((f) => ({
          name: f.nombre,
          type: "external",
          external: { url: f.url },
        })),
      },
      Póliza: {
        files: input.poliza.map((f) => ({
          name: f.nombre,
          type: "external",
          external: { url: f.url },
        })),
      },
      Status: { status: { name: STATUS_INICIAL } },
      Respuesta: { rich_text: [] },
    },
  });
  return response as unknown as SolicitudPreAutorizacionPage;
}

export async function archivePage(pageId: string) {
  await notion.pages.update({ page_id: pageId, archived: true });
}
