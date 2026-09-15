import { beforeEach, expect, mock, test } from "bun:test";
import type { Solicitud } from "../services/notion";

const ID = "3da129e1-a3ac-80b4-b7a0-d1eb56fd76e5";

let resolverLista: (solicitudes: Solicitud[]) => void = () => {};
const listSolicitudes = mock(
  () => new Promise<Solicitud[]>((resolve) => (resolverLista = resolve)),
);
const updateSolicitudResult = mock(
  async (_id: string, _status: string, _respuesta: string) => {},
);
const updateSolicitudStatus = mock(async () => {});

mock.module("../services/notion", () => ({
  listSolicitudes,
  updateSolicitudResult,
  updateSolicitudStatus,
}));
mock.module("../middlewares/extractor", () => ({
  extractDocuments: async () => {
    throw new Error("no debería llamarse");
  },
  EXTRACTION_MODEL: "test",
}));
mock.module("../services/ai", () => ({
  analyzeSolicitud: async () => {
    throw new Error("no debería llamarse");
  },
  ANALYSIS_MODEL: "test",
}));

const { limpiarSolicitud, processSolicitud, HttpError } =
  await import("../services/pipeline");

beforeEach(() => {
  listSolicitudes.mockClear();
  updateSolicitudResult.mockClear();
  updateSolicitudStatus.mockClear();
});

test("limpiarSolicitud reinicia Status y vacía Respuesta", async () => {
  await limpiarSolicitud(ID);

  expect(updateSolicitudResult).toHaveBeenCalledTimes(1);
  expect(updateSolicitudResult).toHaveBeenCalledWith(ID, "En revision", "");
});

test("limpiarSolicitud devuelve 409 mientras la solicitud se procesa", async () => {
  const proceso = processSolicitud(ID.replaceAll("-", "")).catch((e) => e);
  expect(listSolicitudes).toHaveBeenCalledTimes(1);

  const error = await limpiarSolicitud(ID).catch((e) => e);
  expect(error).toBeInstanceOf(HttpError);
  expect(error.status).toBe(409);
  expect(updateSolicitudResult).not.toHaveBeenCalled();

  resolverLista([]);
  expect((await proceso).status).toBe(404);

  await limpiarSolicitud(ID);
  expect(updateSolicitudResult).toHaveBeenCalledTimes(1);
});

test("limpiarSolicitud con id mal formado devuelve 404 sin llamar a Notion", async () => {
  const error = await limpiarSolicitud("no-existe").catch((e) => e);
  expect(error).toBeInstanceOf(HttpError);
  expect(error.status).toBe(404);
  expect(updateSolicitudResult).not.toHaveBeenCalled();
});
