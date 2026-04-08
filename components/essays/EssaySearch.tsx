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
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (!raw.trim()) {
      params.delete("q");
      params.delete("vibe_tone");
      router.push(`${pathname}?${params.toString()}`);
      return;
    }

    params.set("q", raw.trim());

    // Try vibe parsing; fall back gracefully if it fails or key isn't set
    try {
      setParsing(true);
      const res = await fetch(`/api/vibe-search?q=${encodeURIComponent(raw.trim())}`);
      if (res.ok) {
        const intent = await res.json();
        if (intent.tones?.length > 0) {
          params.set("vibe_tone", intent.tones[0]);
        } else {
          params.delete("vibe_tone");
        }
        if (intent.themes?.length > 0) {
          params.set("vibe_themes", intent.themes.join(","));
        } else {
          params.delete("vibe_themes");
        }
        if (intent.target_uni && !searchParams.get("university")) {
          params.set("detected_uni", intent.target_uni);
        } else {
          params.delete("detected_uni");
        }
        if (intent.semantic_keywords) {
          params.set("q", intent.semantic_keywords);
        }
      }
    } catch {
      // Gemini unavailable — plain text search still works
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
    params.delete("vibe_tone");
    params.delete("vibe_themes");
    params.delete("detected_uni");
    params.delete("page");
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
        placeholder="Describe your vibe — e.g. humble Harvard essay about coding…"
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
