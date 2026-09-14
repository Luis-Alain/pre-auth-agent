import { z } from "zod";

export const ESTADOS_FINALES = [
  "Pre Aprobada",
  "Rechazada",
  "Documentos Faltantes",
] as const;
export type EstadoFinal = (typeof ESTADOS_FINALES)[number];

export const AnalisisSchema = z.object({
  status: z.enum(ESTADOS_FINALES),
  cobertura: z.object({
    cubierto: z.boolean().nullable(),
    clausulasAplicables: z.array(z.string()),
    razon: z.string(),
  }),
  periodoCarencia: z.object({
    aplica: z.boolean().nullable(),
    periodoRequerido: z.string().nullable(),
    fechaInicioPoliza: z.string().nullable(),
    fechaSolicitud: z.string(),
    tiempoTranscurrido: z.string().nullable(),
    cumplido: z.boolean().nullable(),
    razon: z.string(),
  }),
  documentosFaltantes: z.array(z.string()),
  justificacion: z.string(),
});

export type Analisis = z.infer<typeof AnalisisSchema>;
