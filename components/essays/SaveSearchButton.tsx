"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookmarkPlus, Check } from "lucide-react";
import {
  describeFilters,
  filtersFromSearchParams,
  isEmptyFilters,
} from "@/lib/saved-search/filters";

/**
 * "Save this search" on the Browse page.
 *
 * Reads the live URL params, normalises them the same way the digest job will,
 * and pins them. Hidden entirely when nothing is filtered — a saved search that
 * matches everything is just a subscription to the whole site.
 */
export function SaveSearchButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = filtersFromSearchParams(
    new URLSearchParams(searchParams.toString()),
  );

  if (isEmptyFilters(filters)) return null;

  async function save() {
    if (!isLoggedIn) {
      router.push(
        `/login?redirect=${encodeURIComponent(`/applications?${searchParams.toString()}`)}`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, name: describeFilters(filters) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Couldn't save that search.");
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        Saved — we&apos;ll email you
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:border-[#0851A0] hover:text-[#0851A0] disabled:opacity-60"
        title={describeFilters(filters)}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        {saving ? "Saving…" : "Save this search"}
      </button>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </div>
  );
}
