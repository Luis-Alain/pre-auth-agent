import { expect, test } from "bun:test";
import { ESTADOS_FINALES } from "../schemas/analysis";
import { puedeLimpiar } from "./cleanup";

test("la limpieza automática espera cinco minutos; la manual no", () => {
  const inicio = Date.parse("2026-09-14T12:00:00Z");
  for (const status of ESTADOS_FINALES) {
    const solicitud = { status, lastEditedTime: new Date(inicio).toISOString() };
    expect(puedeLimpiar(solicitud, true, inicio + 30_000)).toBe(false);
    expect(puedeLimpiar(solicitud, true, inicio + 299_999)).toBe(false);
    expect(puedeLimpiar(solicitud, true, inicio + 300_000)).toBe(true);
    expect(puedeLimpiar(solicitud, false, inicio)).toBe(true);
  }
  expect(puedeLimpiar({ status: null, lastEditedTime: new Date(inicio).toISOString() }, true, inicio + 600_000)).toBe(false);
});
