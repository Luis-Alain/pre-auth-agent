import { z } from "zod";

const texto = z.string().nullable();
const fecha = z.string().nullable().describe("Fecha en formato YYYY-MM-DD, o null si no aparece.");

export const InformeMedicoSchema = z.object({
  paciente: z.object({
    nombre: texto,
    documento: texto,
    fechaNacimiento: fecha,
  }),
  medico: z.object({
    nombre: texto,
    especialidad: texto,
    registro: texto,
  }),
  fechaInforme: fecha,
  diagnosticos: z.array(
    z.object({
      descripcion: z.string(),
      cie10: texto,
    }),
  ),
  procedimientoSolicitado: z.object({
    descripcion: texto,
    cpt: texto,
    categoria: texto.describe("Categoría del procedimiento, p. ej. cirugía, imagenología, maternidad."),
    urgente: z.boolean().nullable(),
  }),
  fechaInicioSintomas: fecha,
  fechaDiagnostico: fecha,
  justificacionClinica: texto,
  datosFaltantes: z.array(z.string()).describe("Datos relevantes que no aparecen o son ilegibles."),
});

export const PolizaSchema = z.object({
  numeroPoliza: texto,
  aseguradora: texto,
  plan: texto,
  titular: texto,
  asegurados: z.array(z.string()),
  fechaInicioVigencia: fecha,
  fechaFinVigencia: fecha,
  coberturas: z.array(
    z.object({
      categoria: z.string(),
      descripcion: texto,
      cubierto: z.boolean(),
      limite: texto,
      copago: texto,
    }),
  ),
  exclusiones: z.array(z.string()),
  periodosCarencia: z.array(
    z.object({
      aplicaA: z.string().describe("Procedimiento o categoría a la que aplica el período de carencia."),
      duracion: z.number().nullable(),
      unidad: z.enum(["dias", "meses", "anios"]).nullable(),
      descripcion: texto,
    }),
  ),
  requisitosPreautorizacion: z.array(z.string()),
  datosFaltantes: z.array(z.string()).describe("Datos relevantes que no aparecen o son ilegibles."),
});

export type InformeMedico = z.infer<typeof InformeMedicoSchema>;
export type Poliza = z.infer<typeof PolizaSchema>;
