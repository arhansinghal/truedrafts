import { Sparkles, FileText, BookOpen, Lightbulb } from "lucide-react";

export interface InsightBrief {
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

export function InsightPreview({ brief }: { brief: InsightBrief }) {
  const summary   = brief.common_app?.summary?.trim();
  const topics    = (brief.common_app?.topics ?? []).filter(Boolean);
  const supps     = brief.supplementals ?? [];
  const takeaways = (brief.what_youll_learn ?? []).filter(Boolean);

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f5f9ff] to-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-[#0851A0]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#0851A0]">
          AI Summary — Before you buy
        </span>
      </div>

      {summary && (
        <section className="mb-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <BookOpen className="h-3.5 w-3.5" />
            Common App
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{summary}</p>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {topics.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white border border-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-[#0851A0]"
                >
                  {t.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {supps.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <FileText className="h-3.5 w-3.5" />
            Supplementals ({supps.length})
          </div>
          <ol className="space-y-2.5">
            {supps.map((s, i) => (
              <li key={i} className="rounded-lg bg-white/80 border border-gray-100 p-3">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm font-medium text-gray-800">
                    {i + 1}. {s.prompt_summary ?? "Supplemental"}
                  </span>
                  {typeof s.word_count === "number" && (
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {s.word_count} words
                    </span>
                  )}
                </div>
                {s.content_summary && (
                  <p className="text-xs text-gray-600 leading-relaxed">{s.content_summary}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {takeaways.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            <Lightbulb className="h-3.5 w-3.5" />
            What you'll learn
          </div>
          <ul className="space-y-1.5">
            {takeaways.map((t, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-[#0851A0] shrink-0">→</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
