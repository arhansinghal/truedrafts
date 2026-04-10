import { parseSearchQuery } from "@/lib/gemma";

const AI_SERVICE = process.env.AI_SERVICE_URL; // e.g. https://truedrafts-ai.fly.dev

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return Response.json({ tones: [], themes: [], target_uni: null, semantic_keywords: "" });

  // Try Python AI service first (GLM-4.5-Air — fast, cheap)
  if (AI_SERVICE) {
    try {
      const res = await fetch(`${AI_SERVICE}/parse?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(2000), // 2s hard timeout
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json(data);
      }
    } catch {
      // Fall through to Gemini fallback
    }
  }

  // Fallback: Gemini (existing implementation)
  const intent = await parseSearchQuery(q);
  if (!intent) {
    return Response.json({ tones: [], themes: [], target_uni: null, semantic_keywords: q });
  }
  return Response.json(intent);
}
