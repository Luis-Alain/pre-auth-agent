import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  InformeMedicoSchema,
  PolizaSchema,
  type InformeMedico,
  type Poliza,
} from "../schemas/extraction";
import type { DocumentoLocal, DocumentosDescargados } from "../services/storage";

const client = new OpenAI();

export const EXTRACTION_MODEL = "gpt-4o-mini";

export interface DocumentosExtraidos {
  informeMedico: InformeMedico;
  poliza: Poliza;
}

const INSTRUCCIONES =
  "Eres un asistente que extrae datos de documentos de seguros médicos. Extrae únicamente la información presente en los documentos, sin inventar nada. Si un dato no aparece o es ilegible, devuelve null y agrégalo a datosFaltantes. Escribe las fechas en formato YYYY-MM-DD.";

const EXTRACTION_PROMPTS = {
  informeMedico:
    "Extrae los datos de este informe médico: paciente, médico tratante, fecha del informe, diagnósticos (códigos CIE-10 si existen), procedimiento solicitado (código CPT si existe), fecha de inicio de síntomas o de diagnóstico y la justificación clínica.",
  poliza:
    "Extrae los datos de esta póliza de seguro médico: número de póliza, aseguradora, plan, titular y asegurados, fechas de inicio y fin de vigencia, coberturas, exclusiones, límites, períodos de carencia (a qué procedimiento o categoría aplican y su duración) y requisitos de pre autorización.",
} as const;

async function toInputContent(documento: DocumentoLocal): Promise<ResponseInputContent> {
  const base64 = Buffer.from(await Bun.file(documento.ruta).arrayBuffer()).toString("base64");
  const dataUrl = `data:${documento.mimeType};base64,${base64}`;

  if (documento.mimeType.startsWith("image/")) {
    return { type: "input_image", image_url: dataUrl, detail: "high" };
  }
  return { type: "input_file", filename: documento.nombre, file_data: dataUrl };
}

async function buildInput(prompt: string, documentos: DocumentoLocal[]) {
  const archivos = await Promise.all(documentos.map(toInputContent));
  return [
    {
      role: "user" as const,
      content: [{ type: "input_text" as const, text: prompt }, ...archivos],
    },
  ];
}

async function extractInformeMedico(documentos: DocumentoLocal[]): Promise<InformeMedico> {
  const response = await client.responses.parse({
    model: EXTRACTION_MODEL,
    instructions: INSTRUCCIONES,
    input: await buildInput(EXTRACTION_PROMPTS.informeMedico, documentos),
    text: { format: zodTextFormat(InformeMedicoSchema, "informe_medico") },
  });
  if (!response.output_parsed) {
    throw new Error("El modelo no devolvió datos estructurados del informe médico.");
  }
  return response.output_parsed;
}

async function extractPoliza(documentos: DocumentoLocal[]): Promise<Poliza> {
  const response = await client.responses.parse({
    model: EXTRACTION_MODEL,
    instructions: INSTRUCCIONES,
    input: await buildInput(EXTRACTION_PROMPTS.poliza, documentos),
    text: { format: zodTextFormat(PolizaSchema, "poliza") },
  });
  if (!response.output_parsed) {
    throw new Error("El modelo no devolvió datos estructurados de la póliza.");
  }
  return response.output_parsed;
}

export async function extractDocuments(documentos: DocumentosDescargados): Promise<DocumentosExtraidos> {
  const [informeMedico, poliza] = await Promise.all([
    extractInformeMedico(documentos.informeMedico),
    extractPoliza(documentos.poliza),
  ]);
  return { informeMedico, poliza };
}
