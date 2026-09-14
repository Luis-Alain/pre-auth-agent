import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AnalisisSchema, type Analisis } from "../schemas/analysis";
import type { InformeMedico, Poliza } from "../schemas/extraction";

const client = new OpenAI();

export const ANALYSIS_MODEL = "gpt-5.6-luna";

const INSTRUCCIONES = `Eres un auditor médico de una aseguradora que evalúa solicitudes de pre autorización.
Recibirás en JSON los datos extraídos del informe médico y de la póliza del paciente, y la fecha de la solicitud (fechaSolicitud).

Debes evaluar:
1. Cobertura: si el procedimiento solicitado está cubierto por la póliza y no está en sus exclusiones.
2. Período de carencia: si desde el inicio de vigencia de la póliza (fechaInicioVigencia) hasta fechaSolicitud ya transcurrió el período de carencia que la póliza exige para ese procedimiento o su categoría. Calcula el tiempo transcurrido explícitamente.

Reglas de decisión (aplícalas en este orden):
- "Documentos Faltantes": falta o es ilegible algún dato indispensable para decidir (procedimiento solicitado, fecha de inicio de vigencia, coberturas, cláusula de carencia aplicable o identidad del paciente/titular). Lista cada dato faltante en documentosFaltantes.
- "Rechazada": el procedimiento no está cubierto o está excluido, o el período de carencia no se ha cumplido a la fecha de la solicitud, o la póliza no estaba vigente en esa fecha.
- "Pre Aprobada": el procedimiento está cubierto y el período de carencia se cumplió (o no aplica ninguno).

Basa cada conclusión únicamente en los datos recibidos, sin suponer información que no esté presente. Cita las cláusulas o coberturas aplicables. Responde en español.`;

export interface AnalisisInput {
  fechaSolicitud: string;
  informeMedico: InformeMedico;
  poliza: Poliza;
}

export async function analyzeSolicitud(input: AnalisisInput): Promise<Analisis> {
  const response = await client.responses.parse({
    model: ANALYSIS_MODEL,
    instructions: INSTRUCCIONES,
    input: JSON.stringify(input, null, 2),
    text: { format: zodTextFormat(AnalisisSchema, "analisis_preautorizacion") },
  });
  if (!response.output_parsed) {
    throw new Error("El modelo de análisis no devolvió una respuesta válida.");
  }
  return response.output_parsed;
}
