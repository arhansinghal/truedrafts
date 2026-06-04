// POST /api/studio/suggest
// Body: { essayId, sentence, webEnabled?: boolean }
//
// Pipeline: classify → (skip if not researchable) → cache lookup → retrieve
// (hub + library + optional web) → Haiku synth → return suggestions.
//
// Skipped sentences return { suggestions: [], skipped: true, reason } cheaply
// so the client can grey out the panel without spamming retries.

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioEssays } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { classifySentence } from "@/lib/studio/classifier";
import { retrieve } from "@/lib/studio/retrieval";
import { synthesize } from "@/lib/studio/synthesize";
import { checkAndIncrement } from "@/lib/studio/rate-limit";
import { cacheGet, cacheKey, cacheSet } from "@/lib/studio/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SuggestRequest = {
  essayId?: string;
  sentence?: string;
  webEnabled?: boolean;
};

export type SuggestionItem = {
  id: string;
  sentence: string;
  text: string;
  reason: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceKind: "hub" | "web" | "style" | null;
};

export type SuggestResponse = {
  suggestions: SuggestionItem[];
  skipped: boolean;
  reason: string;
  webUsed: boolean;
};

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as SuggestRequest;
  const { essayId, sentence } = body;
  const webEnabled = !!body.webEnabled;
  if (!essayId || !sentence) {
    return Response.json({ error: "essayId and sentence required" }, { status: 400 });
  }

  // Classify before any DB / network call — cheapest gate.
  const cls = classifySentence(sentence);
  if (!cls.researchable) {
    return Response.json({
      suggestions: [],
      skipped: true,
      reason: cls.reason,
      webUsed: false,
    } satisfies SuggestResponse);
  }

  // Ownership + university lookup in one query.
  const essay = await db.query.studioEssays.findFirst({
    where: eq(studioEssays.id, essayId),
    with: { app: { with: { university: true } } },
  });
  if (!essay || essay.app.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const key = cacheKey(essay.appId, sentence, webEnabled);
  const cached = cacheGet<SuggestResponse>(key);
  if (cached) return Response.json(cached);

  // Rate limit ONLY on cache miss — repeated edits don't burn budget.
  const rl = await checkAndIncrement(session.user.id);
  if (!rl.ok) {
    return Response.json(
      {
        error: "Rate limit exceeded",
        bucket: rl.bucket,
        retryAfterSec: rl.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const bundle = await retrieve({
    query: sentence,
    topicHint: cls.topicHint,
    appId: essay.appId,
    universityId: essay.app.universityId,
    webEnabled,
  });

  const synth = await synthesize({
    sentence,
    prompt: essay.prompt,
    essayContext: essay.contentText ?? "",
    bundle,
  });

  // Map synth output → flat client-facing items with source URLs.
  const items: SuggestionItem[] = synth.suggestions.map((s) => {
    let sourceLabel = "Style emulation";
    let sourceUrl: string | null = null;
    let sourceKind: "hub" | "web" | "style" | null = "style";
    if (s.citationKind === "hub" && s.citationIndex !== null) {
      const hub = bundle.hub[s.citationIndex - 1];
      if (hub) {
        sourceLabel = hub.source.title;
        sourceUrl = hub.source.uri;
        sourceKind = "hub";
      }
    } else if (s.citationKind === "web" && s.citationIndex !== null) {
      const offset = bundle.hub.length;
      const web = bundle.web[s.citationIndex - 1 - offset];
      if (web) {
        sourceLabel = web.source.title;
        sourceUrl = web.source.url;
        sourceKind = "web";
      }
    }
    return {
      id: crypto.randomUUID(),
      sentence,
      text: s.text,
      reason: s.reason,
      sourceLabel,
      sourceUrl,
      sourceKind,
    };
  });

  const result: SuggestResponse = {
    suggestions: items,
    skipped: false,
    reason: cls.reason,
    webUsed: webEnabled && bundle.web.length > 0,
  };
  cacheSet(key, result);
  return Response.json(result);
}
