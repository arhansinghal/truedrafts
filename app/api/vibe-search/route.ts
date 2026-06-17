import { parseVibeSearchQuery } from "@/lib/vibe-anthropic";
import { rateLimit, clientIp } from "@/lib/ip-rate-limit";
import {
  resolveUniversitySlug,
  resolveState,
  resolveRegion,
  resolveUniversityType,
  STATE_ALIAS_MAP,
  REGION_ALIAS_MAP,
  TYPE_ALIAS_MAP,
  UNIVERSITY_ALIAS_MAP,
} from "@/lib/university-lookup";

const AI_SERVICE = process.env.AI_SERVICE_URL;

const EMPTY_INTENT = {
  tones: [] as string[],
  themes: [] as string[],
  target_uni: null as string | null,
  target_uni_slug: null as string | null,
  semantic_keywords: "",
  major: null as string | null,
  target_years: [] as number[],
  ivy_league: false,
  activities: [] as string[],
  state: null as string | null,
  region: null as string | null,
  university_type: null as string | null,
};

/** Post-process an intent from any source: normalize slugs, state, region, type. */
function normalizeIntent(raw: Record<string, unknown>) {
  const intent = { ...EMPTY_INTENT, ...raw };

  // Resolve target_uni → canonical slug if AI didn't
  if (intent.target_uni && !intent.target_uni_slug) {
    intent.target_uni_slug = resolveUniversitySlug(String(intent.target_uni));
  }

  // Normalize state
  if (intent.state && typeof intent.state === "string") {
    intent.state = resolveState(intent.state) ?? intent.state;
  }

  // Normalize region
  if (intent.region && typeof intent.region === "string") {
    intent.region = resolveRegion(intent.region) ?? intent.region;
  }

  // Normalize university_type
  if (intent.university_type && typeof intent.university_type === "string") {
    intent.university_type = resolveUniversityType(intent.university_type) ?? intent.university_type;
  }

  // Array safety
  if (!Array.isArray(intent.tones)) intent.tones = [];
  if (!Array.isArray(intent.themes)) intent.themes = [];
  if (!Array.isArray(intent.target_years)) intent.target_years = [];
  if (!Array.isArray(intent.activities)) intent.activities = [];
  intent.ivy_league = Boolean(intent.ivy_league);
  if (!intent.semantic_keywords) intent.semantic_keywords = "";

  return intent;
}

// Public endpoint: cap the query length (bounds LLM token cost per call) and
// rate-limit the LLM path per IP. Abusive callers still get working search via
// the heuristic fallback below — they just don't get the (paid) LLM parse.
const MAX_Q_LEN = 200;
const LLM_PER_MIN = 15;

export async function GET(req: Request) {
  let q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ ...EMPTY_INTENT });
  }
  if (q.length > MAX_Q_LEN) q = q.slice(0, MAX_Q_LEN);

  // 1) LLM parse — primary, but gated. parseVibeSearchQuery routes to the model
  //    named by VIBE_FAST_MODEL (DeepSeek by default) and returns null if its
  //    key is missing. We skip it when the caller is over its per-IP budget so a
  //    scripted loop can't drive unbounded LLM spend; search still works via the
  //    heuristic parser below.
  const llmAllowed = rateLimit(`vibe:${clientIp(req)}`, LLM_PER_MIN, 60_000);
  if (llmAllowed && (process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY)) {
    const intent = await parseVibeSearchQuery(q);
    if (intent) return Response.json(normalizeIntent(intent as unknown as Record<string, unknown>));
  }

  // 2) Optional Python AI service (also external — skip it when throttled).
  if (llmAllowed && AI_SERVICE) {
    try {
      const res = await fetch(`${AI_SERVICE}/parse?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        return Response.json(normalizeIntent(data));
      }
    } catch {
      // fall through
    }
  }

  // 3) Minimal fallback — heuristic parse over raw text.
  //    Scan for any alias phrase (state / region / type / university) that
  //    appears as a substring of the query; longest match wins per category.
  //    Matched phrases are stripped from semantic_keywords so the remaining
  //    tokens feed the text-match ILIKE cleanly.
  const lower = q.toLowerCase();
  const consumed: Array<[number, number]> = [];

  const findLongest = (map: Record<string, string>): { key: string; value: string } | null => {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      const idx = lower.indexOf(k);
      if (idx === -1) continue;
      const before = idx === 0 ? " " : lower[idx - 1];
      const after = idx + k.length >= lower.length ? " " : lower[idx + k.length];
      // Require word boundary so "in" doesn't match "India".
      if (!/[\w]/.test(before) && !/[\w]/.test(after)) {
        consumed.push([idx, idx + k.length]);
        return { key: k, value: map[k] };
      }
    }
    return null;
  };

  const stateHit  = findLongest(STATE_ALIAS_MAP);
  const regionHit = findLongest(REGION_ALIAS_MAP);
  const typeHit   = findLongest(TYPE_ALIAS_MAP);
  const uniHit    = findLongest(UNIVERSITY_ALIAS_MAP);

  // Strip consumed spans to produce residual semantic keywords.
  let residual = q;
  if (consumed.length > 0) {
    consumed.sort((a, b) => b[0] - a[0]);
    for (const [start, end] of consumed) {
      residual = residual.slice(0, start) + " " + residual.slice(end);
    }
    residual = residual.replace(/\s+/g, " ").trim();
  }

  const ivyLeague = typeHit?.value === "ivy";
  const universityType = typeHit && typeHit.value !== "ivy" ? typeHit.value : null;

  return Response.json({
    ...EMPTY_INTENT,
    target_uni_slug: uniHit?.value ?? resolveUniversitySlug(q),
    state: stateHit?.value ?? null,
    region: regionHit?.value ?? null,
    university_type: universityType,
    ivy_league: ivyLeague,
    semantic_keywords: residual || q,
  });
}
