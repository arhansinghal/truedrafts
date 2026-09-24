
interface InsightBrief {
  common_app?: { summary?: string; topics?: string[] };
  supplementals?: Array<{
    prompt_summary?: string;
    content_summary?: string;
    word_count?: number;
  }>;
  num_supplementals?: number;
  what_youll_learn?: string[];
  generated_at?: string;
}

/**
 * Parses the `insight_brief` TEXT column. Returns null on parse error AND on
 * old-schema briefs (missing `common_app.summary`) so stale rows hide cleanly
 * instead of rendering garbage until the backfill script catches up.
 */
export function parseInsightBrief(raw: string | null | undefined): InsightBrief | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InsightBrief;
    if (!parsed?.common_app?.summary && !parsed?.supplementals?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

