import { parseSearchQuery } from "@/lib/gemma";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ tones: [], target_uni: null, semantic_keywords: "" });

  const intent = await parseSearchQuery(q);
  if (!intent) {
    // Fallback: treat raw query as semantic keywords
    return Response.json({ tones: [], target_uni: null, semantic_keywords: q });
  }
  return Response.json(intent);
}
