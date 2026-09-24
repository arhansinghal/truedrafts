// Voyage AI embeddings — voyage-3.5-lite (1024-dim via output_dimension,
// fast, cheap). voyage-3-lite was 512-only; 3.5-lite supports 256/512/1024/
// 2048 via matryoshka truncation.
//
// Direct REST call rather than the official SDK to keep the dependency surface
// small. Returns null when the key is missing so callers can degrade
// gracefully (sources still uploadable, just not retrievable).

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5-lite";
const EMBEDDING_DIMS = 1024;

type VoyageInput = "document" | "query";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
  usage?: { total_tokens: number };
};

export function isEmbeddingsEnabled(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

export async function embed(
  texts: string[],
  inputType: VoyageInput = "document",
): Promise<number[][] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || texts.length === 0) return null;

  const trimmed = texts.map((t) => t.trim()).filter(Boolean);
  if (trimmed.length === 0) return null;

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: trimmed,
      input_type: inputType,
      // voyage-3-lite defaults to 512-dim; our pgvector columns are 1024-dim.
      output_dimension: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Voyage ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as VoyageResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export async function embedOne(
  text: string,
  inputType: VoyageInput = "query",
): Promise<number[] | null> {
  const out = await embed([text], inputType);
  return out?.[0] ?? null;
}

// Format a number[] as the Postgres vector literal '[0.1,0.2,...]'.
// Used directly in raw SQL parameters; drizzle's vector mapper handles the
// query-side, but for the ORDER BY <-> operator we need the literal form.
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
