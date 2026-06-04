"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, FileText, Loader2, ChevronLeft, BookOpen } from "lucide-react";
import { StudioEditor, type StudioEditorHandle } from "./StudioEditor";
import { SuggestionsPanel, type Suggestion } from "./SuggestionsPanel";
import { HubPanel } from "./HubPanel";
import type { SuggestResponse } from "@/app/api/studio/suggest/route";

type EssayListItem = {
  id: string;
  title: string;
  wordCount: number;
  wordCap: number | null;
  status: string;
};

type ActiveEssay = {
  id: string;
  title: string;
  prompt: string | null;
  wordCap: number | null;
  content: string;
  contentText: string;
  wordCount: number;
  status: string;
};

export function StudioWorkspace({
  app,
  essays,
  activeEssayId,
  activeEssay,
}: {
  app: { id: string; title: string; university: { name: string; slug: string } };
  essays: EssayListItem[];
  activeEssayId: string;
  activeEssay: ActiveEssay;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newCap, setNewCap] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const editorRef = useRef<StudioEditorHandle>(null);
  // Latch the active in-flight request so sentence-end bursts cancel old ones.
  const inflightRef = useRef<AbortController | null>(null);

  async function createEssay() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/studio/essays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          title: newTitle,
          prompt: newPrompt || undefined,
          wordCap: newCap ? Number(newCap) : undefined,
        }),
      });
      if (res.ok) {
        const e = await res.json();
        setCreating(false);
        setNewTitle("");
        setNewPrompt("");
        setNewCap("");
        router.push(`/studio/${app.id}/${e.id}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const fetchSuggestions = useCallback(
    async (sentence: string) => {
      console.log("[studio] fetchSuggestions →", sentence);
      if (inflightRef.current) inflightRef.current.abort();
      const ctrl = new AbortController();
      inflightRef.current = ctrl;
      setLoading(true);
      setLastStatus(`Analyzing: "${sentence.slice(0, 60)}${sentence.length > 60 ? "…" : ""}"`);
      try {
        const res = await fetch("/api/studio/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            essayId: activeEssayId,
            sentence,
            webEnabled,
          }),
          signal: ctrl.signal,
        });
        console.log("[studio] POST /api/studio/suggest →", res.status);
        if (!res.ok) {
          if (res.status === 429) {
            setLastStatus("Rate limited — try again in a minute.");
            setSuggestions([
              {
                id: crypto.randomUUID(),
                sentence,
                text: "Slow down a bit — too many suggestion requests in a short window. Try again in a minute.",
                reason: "rate limit",
                sourceLabel: "TrueDrafts",
                sourceUrl: null,
                sourceKind: null,
              },
            ]);
          } else {
            setLastStatus(`Request failed (${res.status})`);
          }
          return;
        }
        const data = (await res.json()) as SuggestResponse;
        console.log("[studio] response data →", data);
        if (data.skipped) {
          setLastStatus(`Skipped — not researchable (${data.reason}). Try a factual claim.`);
          return;
        }
        if (data.suggestions.length === 0) {
          setLastStatus("No grounded info found. Add sources to the Hub or enable Web.");
          return;
        }
        setLastStatus(null);
        setSuggestions(data.suggestions);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[studio] fetch error", err);
        setLastStatus("Error — see console.");
      } finally {
        if (inflightRef.current === ctrl) {
          inflightRef.current = null;
          setLoading(false);
        }
      }
    },
    [activeEssayId, webEnabled],
  );

  // Reset suggestions when navigating between essays.
  useEffect(() => {
    setSuggestions([]);
    setLoading(false);
    setLastStatus(null);
  }, [activeEssayId]);

  function handleInsert(s: Suggestion) {
    editorRef.current?.insertText(s.text);
    // Drop the inserted card so the panel reflects what's still on the table.
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
  }

  return (
    <div className="flex h-full bg-white">
      {/* Left: minimal essay sidebar */}
      <aside className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col">
        <div className="px-4 pt-4 pb-3">
          <Link
            href="/studio"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 mb-3"
          >
            <ChevronLeft className="h-3 w-3" />
            All workspaces
          </Link>
          <p className="text-sm font-semibold text-gray-900 truncate">{app.title}</p>
          <p className="text-[10px] text-gray-400 truncate mt-0.5">
            {app.university.name}
          </p>
        </div>

        <div className="px-3 pb-2">
          <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Essays
          </p>
          <nav className="space-y-0.5">
            {essays.map((e) => {
              const active = e.id === activeEssayId;
              return (
                <Link
                  key={e.id}
                  href={`/studio/${app.id}/${e.id}`}
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-white text-gray-900 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      : "text-gray-600 hover:bg-white hover:text-gray-900"
                  }`}
                >
                  <FileText className="h-3 w-3 shrink-0 mt-0.5 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{e.title}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {e.wordCount}
                      {e.wordCap ? ` / ${e.wordCap}` : ""} words
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="px-3 pb-3">
          {creating ? (
            <div className="space-y-1.5">
              <input
                placeholder="Essay title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full h-7 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
                autoFocus
              />
              <textarea
                placeholder="Prompt (optional)"
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                className="w-full text-xs min-h-[44px] rounded-md border border-gray-200 px-2 py-1 focus:outline-none focus:border-gray-400"
              />
              <input
                placeholder="Word cap"
                value={newCap}
                onChange={(e) => setNewCap(e.target.value.replace(/\D/g, ""))}
                className="w-full h-7 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={createEssay}
                  disabled={busy || !newTitle.trim()}
                  className="flex-1 h-7 rounded-md bg-gray-900 text-white text-xs hover:bg-gray-800 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="h-7 px-2 text-xs text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-white hover:text-gray-900"
            >
              <Plus className="h-3 w-3" />
              New essay
            </button>
          )}
        </div>

        <div className="mt-auto border-t border-gray-100 px-4 py-3">
          <Link
            href={`/applications/${app.university.slug}`}
            className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
          >
            <BookOpen className="h-3 w-3" />
            Browse {app.university.name} essays
          </Link>
        </div>
      </aside>

      {/* Center: editor */}
      <section className="flex-1 min-w-0 overflow-y-auto">
        <StudioEditor
          ref={editorRef}
          key={activeEssay.id}
          essayId={activeEssay.id}
          initialTitle={activeEssay.title}
          initialPrompt={activeEssay.prompt}
          initialWordCap={activeEssay.wordCap}
          initialContent={activeEssay.content}
          onSentenceEnd={fetchSuggestions}
        />
      </section>

      {/* Right: hub + suggestions */}
      <aside className="w-80 shrink-0 border-l border-gray-100 bg-white flex flex-col">
        <HubPanel appId={app.id} />
        <SuggestionsPanel
          suggestions={suggestions}
          loading={loading}
          webEnabled={webEnabled}
          status={lastStatus}
          onWebToggle={setWebEnabled}
          onInsert={handleInsert}
        />
      </aside>
    </div>
  );
}
