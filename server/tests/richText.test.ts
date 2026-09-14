import { expect, test } from "bun:test";
import { chunkRichText } from "../services/richText";

test("chunkRichText divide en bloques de 2000 caracteres", () => {
  const chunks = chunkRichText("a".repeat(4500));
  expect(chunks.map((c) => c.text.content.length)).toEqual([2000, 2000, 500]);
});

test("chunkRichText devuelve vacío para texto vacío", () => {
  expect(chunkRichText("")).toEqual([]);
});
