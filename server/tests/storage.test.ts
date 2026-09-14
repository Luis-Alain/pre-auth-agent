import { expect, test } from "bun:test";
import { fileBaseName, folderFor } from "../services/storage";

test("folderFor rellena el número a dos dígitos", () => {
  expect(folderFor(1)).toBe("solicitud-01");
  expect(folderFor(12)).toBe("solicitud-12");
  expect(folderFor(123)).toBe("solicitud-123");
});

test("fileBaseName numera los archivos adicionales", () => {
  expect(fileBaseName("poliza", 0)).toBe("poliza");
  expect(fileBaseName("poliza", 1)).toBe("poliza-2");
});
