// Thin Tavily client. Used only when the user toggles web grounding on for a
// given suggestion call — most queries should run hub-only to keep latency
// and cost low.
//
// Tavily returns ranked snippets with source URLs. We pull title + url +
// content + score. No streaming; one POST with a 6s budget.

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
const TAVILY_TIMEOUT_MS = 6_000;

export type TavilyResult = {
  title: string;
  url: string;
  snippet: string;
  score: number;
};


export async function tavilySearch(query: string, maxResults = 4): Promise<TavilyResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !query.trim()) return [];
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TAVILY_TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        topic: "general",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string; score?: number }>;
    };
    return (data.results ?? [])
      .filter((r) => r.url && r.content)
      .map((r) => ({
        title: (r.title ?? r.url ?? "").toString(),
        url: r.url as string,
        snippet: (r.content ?? "").toString().slice(0, 800),
        score: typeof r.score === "number" ? r.score : 0.5,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
