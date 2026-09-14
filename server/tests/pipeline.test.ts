import { beforeEach, expect, mock, test } from "bun:test";
import type { Analisis } from "../schemas/analysis";
import type { Solicitud } from "../services/notion";

const solicitudBase: Solicitud = {
  id: "3da129e1-a3ac-80b4-b7a0-d1eb56fd76e5",
  titular: "Paciente de prueba",
  informeMedico: [
    { nombre: "informe.pdf", url: "https://example.com/informe.pdf" },
  ],
  poliza: [],
  status: null,
  respuesta: "",
  createdTime: "2026-09-01T10:00:00.000Z",
  lastEditedTime: "2026-09-01T10:00:00.000Z",
  url: "https://notion.so/solicitud",
  numero: 3,
};

let solicitudes: Solicitud[] = [];
const updateSolicitudResult = mock(
  async (_id: string, _status: string, _respuesta: string) => {},
);
const updateSolicitudStatus = mock(
  async (_id: string, _status: string | null) => {},
);
const extractDocuments = mock(async () => {
  throw new Error("no debería llamarse");
});
const analyzeSolicitud = mock(async () => {
  throw new Error("no debería llamarse");
});

mock.module("./notion", () => ({
  listSolicitudes: async () => solicitudes,
  updateSolicitudResult,
  updateSolicitudStatus,
}));
mock.module("../middlewares/extractor", () => ({
  extractDocuments,
  EXTRACTION_MODEL: "test",
}));
mock.module("./ai", () => ({ analyzeSolicitud, ANALYSIS_MODEL: "test" }));

const { processSolicitud, formatRespuesta, HttpError } =
  await import("../services/pipeline");

beforeEach(() => {
  solicitudes = [solicitudBase];
  updateSolicitudResult.mockClear();
  updateSolicitudStatus.mockClear();
  extractDocuments.mockClear();
  analyzeSolicitud.mockClear();
});

test("sin póliza marca Documentos Faltantes sin llamar a OpenAI", async () => {
  const resultado = await processSolicitud(
    solicitudBase.id.replaceAll("-", ""),
  );

  expect(resultado.status).toBe("Documentos Faltantes");
  expect(resultado.carpeta).toBe("solicitud-03");
  expect(updateSolicitudResult).toHaveBeenCalledTimes(1);
  expect(updateSolicitudResult.mock.calls[0]?.[1]).toBe("Documentos Faltantes");
  expect(updateSolicitudStatus).not.toHaveBeenCalled();
  expect(extractDocuments).not.toHaveBeenCalled();
  expect(analyzeSolicitud).not.toHaveBeenCalled();
});

test("id desconocido devuelve 404", async () => {
  const error = await processSolicitud("no-existe").catch((e) => e);
  expect(error).toBeInstanceOf(HttpError);
  expect(error.status).toBe(404);
});

test("formatRespuesta resume el análisis", () => {
  const analisis: Analisis = {
    status: "Rechazada",
    cobertura: {
      cubierto: true,
      clausulasAplicables: ["Cláusula 4"],
      razon: "Cirugía cubierta.",
    },
    periodoCarencia: {
      aplica: true,
      periodoRequerido: "10 meses",
      fechaInicioPoliza: "2026-03-01",
      fechaSolicitud: "2026-09-01",
      tiempoTranscurrido: "6 meses",
      cumplido: false,
      razon: "Solo han transcurrido 6 de 10 meses.",
    },
    documentosFaltantes: [],
    justificacion: "No cumple el período de carencia.",
  };

  expect(formatRespuesta(analisis)).toBe(
    [
      "Resultado: Rechazada",
      "Cobertura: Cirugía cubierta.",
      "Período de carencia: Solo han transcurrido 6 de 10 meses.",
      "Justificación: No cumple el período de carencia.",
    ].join("\n"),
  );
});
