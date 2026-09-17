"use client";
import { useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, Sparkles } from "lucide-react";

export function EssaySearch({ currentSearch }: { currentSearch?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(currentSearch ?? "");
  const [parsing, setParsing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function pushVibeSearch(raw: string) {
    let params = new URLSearchParams(window.location.search);
    params.delete("page");

    if (!raw.trim()) {
      params.delete("q");
      params.delete("vibe_q");
      params.delete("vibe_tone");
      params.delete("vibe_themes");
      params.delete("detected_uni");
      params.delete("detected_uni_slug");
      params.delete("detected_major");
      params.delete("detected_years");
      params.delete("detected_state");
      params.delete("detected_region");
      params.delete("detected_type");
      params.delete("ivy");
      params.delete("sort");
      router.push(`${pathname}?${params.toString()}`);
      return;
    }

    const trimmed = raw.trim();
    params.set("vibe_q", trimmed);

    try {
      setParsing(true);
      const res = await fetch(`/api/vibe-search?q=${encodeURIComponent(trimmed)}`);
      const intent = res.ok ? await res.json() : null;
      // The URL may have changed while we awaited (filters, sort, pagination),
      // so rebase onto the live query string before pushing.
      params = new URLSearchParams(window.location.search);
      params.delete("page");
      params.set("vibe_q", trimmed);
      if (intent) {
        const themes = [
          ...(Array.isArray(intent.themes) ? intent.themes : []),
          ...(Array.isArray(intent.activities) ? intent.activities : []),
        ];
        const years = Array.isArray(intent.target_years) ? intent.target_years : [];

        // Tone
        if (intent.tones?.length > 0) {
          params.set("vibe_tone", intent.tones[0]);
        } else {
          params.delete("vibe_tone");
        }

        // Themes + activities
        if (themes.length > 0) {
          params.set("vibe_themes", themes.join(","));
        } else {
          params.delete("vibe_themes");
        }

        // University — prefer resolved slug
        if (!params.get("university")) {
          if (intent.target_uni_slug) {
            params.set("detected_uni_slug", intent.target_uni_slug);
            params.delete("detected_uni");
          } else if (intent.target_uni) {
            params.set("detected_uni", intent.target_uni);
            params.delete("detected_uni_slug");
          } else {
            params.delete("detected_uni");
            params.delete("detected_uni_slug");
          }
        }

        // Major
        if (intent.major && String(intent.major).trim()) {
          params.set("detected_major", String(intent.major).trim());
        } else {
          params.delete("detected_major");
        }

        // Years
        if (years.length > 0) {
          params.set("detected_years", years.join(","));
        } else {
          params.delete("detected_years");
        }

        // Ivy League
        if (intent.ivy_league) {
          params.set("ivy", "1");
        } else {
          params.delete("ivy");
        }

        // State
        if (intent.state) {
          params.set("detected_state", intent.state);
        } else {
          params.delete("detected_state");
        }

        // Region
        if (intent.region) {
          params.set("detected_region", intent.region);
        } else {
          params.delete("detected_region");
        }

        // School type
        if (intent.university_type) {
          params.set("detected_type", intent.university_type);
        } else {
          params.delete("detected_type");
        }

        // Always use the raw user query as q. AI's "semantic_keywords" is a
        // paraphrase — useful for ranking, not for substring matching. Let
        // the page's tokenizer handle synonyms + stopwords.
        params.set("q", trimmed);
        params.set("sort", "relevance");
      } else {
        params.set("q", trimmed);
        params.delete("sort");
      }
    } catch {
      params = new URLSearchParams(window.location.search);
      params.delete("page");
      params.set("vibe_q", trimmed);
      params.set("q", trimmed);
      params.delete("sort");
    } finally {
      setParsing(false);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushVibeSearch(v), 600);
  }

  function handleClear() {
    setValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("vibe_q");
    params.delete("vibe_tone");
    params.delete("vibe_themes");
    params.delete("detected_uni");
    params.delete("detected_uni_slug");
    params.delete("detected_major");
    params.delete("detected_years");
    params.delete("detected_state");
    params.delete("detected_region");
    params.delete("detected_type");
    params.delete("ivy");
    params.delete("page");
    params.delete("sort");
    router.push(`${pathname}?${params.toString()}`);
  }

  const active = !!value;

  return (
    <div
      className="relative flex items-center w-full max-w-xl"
      style={{
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "9999px",
        border: active ? "1.5px solid #0851A0" : "1.5px solid #e5e7eb",
        boxShadow: active
          ? "0 0 0 3px rgba(8,81,160,0.08)"
          : "0 2px 8px rgba(0,0,0,0.06)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {parsing ? (
        <Sparkles className="absolute left-4 w-4 h-4 text-[#0851A0] pointer-events-none shrink-0 animate-pulse" />
      ) : (
        <Search className="absolute left-4 w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
      )}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search by school, activity, major, or vibe — e.g. Penn debate essay…"
        className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 py-2.5 pl-10 pr-10 focus:outline-none rounded-full"
      />
      {active && (
        <button
          onClick={handleClear}
          className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
