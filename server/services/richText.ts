const RICH_TEXT_MAX_CHARS = 2000;
const RICH_TEXT_MAX_ITEMS = 100;

export function chunkRichText(text: string) {
  const chunks = [];
  for (
    let i = 0;
    i < text.length && chunks.length < RICH_TEXT_MAX_ITEMS;
    i += RICH_TEXT_MAX_CHARS
  ) {
    chunks.push({
      type: "text" as const,
      text: { content: text.slice(i, i + RICH_TEXT_MAX_CHARS) },
    });
  }
  return chunks;
}
