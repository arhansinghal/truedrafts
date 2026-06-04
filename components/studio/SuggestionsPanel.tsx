"use client";

import { ExternalLink, Globe, BookOpen, Sparkles, Loader2 } from "lucide-react";

export type Suggestion = {
  id: string;
  sentence: string;
  text: string;
  reason: string;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceKind: "hub" | "web" | "style" | null;
};

export function SuggestionsPanel({
  suggestions,
  loading,
  webEnabled,
  status,
  onWebToggle,
  onInsert,
}: {
  suggestions: Suggestion[];
  loading: boolean;
  webEnabled: boolean;
  status: string | null;
  onWebToggle: (v: boolean) => void;
  onInsert: (s: Suggestion) => void;
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700 inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-gray-700" />
          Suggestions
        </p>
        <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-[10px] text-gray-500">Web</span>
          <span
            className={`relative inline-block h-3.5 w-7 rounded-full transition-colors ${
              webEnabled ? "bg-gray-900" : "bg-gray-200"
            }`}
          >
            <span
              className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
                webEnabled ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={webEnabled}
            onChange={(e) => onWebToggle(e.target.checked)}
          />
        </label>
      </div>

      {status && (
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-600 leading-relaxed inline-flex items-center gap-1.5">
            {loading && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
            {status}
          </p>
        </div>
      )}

      {loading && suggestions.length === 0 && !status && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!loading && suggestions.length === 0 && !status && (
        <div className="flex-1 flex items-center justify-center px-6 py-8 text-center">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Finish a sentence and grounded continuations will appear here. Click a
            card to insert it into your essay.
          </p>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className="group rounded-lg border border-gray-100 bg-white p-3 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => onInsert(s)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onInsert(s)}
            >
              <p className="text-[10px] text-gray-400 mb-1.5 italic line-clamp-1">
                after: &ldquo;{s.sentence}&rdquo;
              </p>
              <p className="text-xs text-gray-900 leading-snug mb-2">{s.text}</p>
              {s.reason && (
                <p className="text-[10px] text-gray-400 leading-snug mb-2">{s.reason}</p>
              )}
              <div className="flex items-center justify-between">
                <SourceTag s={s} />
                <span className="text-[10px] text-gray-300 group-hover:text-gray-500 transition-colors">
                  click to insert →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SourceTag({ s }: { s: Suggestion }) {
  const Icon =
    s.sourceKind === "web" ? Globe : s.sourceKind === "hub" ? BookOpen : Sparkles;
  const inner = (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600">
      <Icon className="h-2.5 w-2.5" />
      <span className="truncate max-w-[10rem]">{s.sourceLabel}</span>
      {s.sourceUrl && <ExternalLink className="h-2.5 w-2.5" />}
    </span>
  );
  if (s.sourceUrl && /^https?:\/\//.test(s.sourceUrl)) {
    return (
      <a
        href={s.sourceUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
      >
        {inner}
      </a>
    );
  }
  return inner;
}
