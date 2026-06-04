// Token-aware chunker for ingestion. We approximate tokens as words / 0.75
// (a common GPT-style heuristic) — exact tokenization would require shipping a
// tokenizer; the approximation is well within Voyage's per-input limit.

const WORDS_PER_CHUNK = 380;   // ~500 tokens
const OVERLAP_WORDS = 38;      // ~50-token overlap

export type Chunk = {
  ord: number;
  text: string;
  tokenCount: number;
};

export function chunkText(text: string): Chunk[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
  if (!cleaned) return [];

  // First pass: split on paragraph boundaries (blank line). Then merge small
  // paragraphs and break large ones at word boundaries.
  const paragraphs = cleaned
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferWords = 0;

  function flush() {
    if (buffer.length === 0) return;
    const text = buffer.join("\n\n");
    chunks.push({
      ord: chunks.length,
      text,
      tokenCount: Math.ceil(bufferWords / 0.75),
    });
    // Sliding overlap: keep last OVERLAP_WORDS for next chunk
    const tailWords = text.split(/\s+/).slice(-OVERLAP_WORDS);
    buffer = tailWords.length ? [tailWords.join(" ")] : [];
    bufferWords = tailWords.length;
  }

  for (const p of paragraphs) {
    const wordCount = p.split(/\s+/).length;
    if (wordCount > WORDS_PER_CHUNK) {
      // Long paragraph — split it directly into word windows.
      flush();
      const words = p.split(/\s+/);
      for (let i = 0; i < words.length; i += WORDS_PER_CHUNK - OVERLAP_WORDS) {
        const slice = words.slice(i, i + WORDS_PER_CHUNK);
        chunks.push({
          ord: chunks.length,
          text: slice.join(" "),
          tokenCount: Math.ceil(slice.length / 0.75),
        });
      }
      continue;
    }
    if (bufferWords + wordCount > WORDS_PER_CHUNK) flush();
    buffer.push(p);
    bufferWords += wordCount;
  }
  flush();

  return chunks;
}
