"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Search, Trash2 } from "lucide-react";
import { browseHref, type SavedSearchFilters } from "@/lib/saved-search/filters";

type Cadence = "off" | "daily" | "weekly";

type Row = {
  id: string;
  name: string;
  cadence: Cadence;
  filters: SavedSearchFilters;
  description: string;
  matchesSent: number;
  lastNotifiedAt: string | null;
  createdAt: string;
};

const CADENCE_LABEL: Record<Cadence, string> = {
  off: "No emails",
  daily: "Daily",
  weekly: "Weekly",
};

export function SavedSearchList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saved-searches");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as Row[]);
    } catch (err) {
      console.error("[saved-search] list fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setCadence(row: Row, cadence: Cadence) {
    setBusyId(row.id);
    // Optimistic — the select should feel instant.
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, cadence } : r)),
    );
    try {
      const res = await fetch(`/api/saved-searches/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[saved-search] cadence update failed", err);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: Row) {
    setBusyId(row.id);
    try {
      await fetch(`/api/saved-searches/${row.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-gray-400">Loading…</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <Search className="mx-auto h-6 w-6 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-700">
          No saved searches yet
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
          Filter Browse down to what you&apos;re actually looking for, then hit
          “Save this search”. We&apos;ll tell you when something new matches.
        </p>
        <Link
          href="/applications"
          className="mt-4 inline-block rounded-lg bg-[#0851A0] px-4 py-2 text-sm font-semibold text-white"
        >
          Browse applications
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <Link
              href={browseHref(row.filters)}
              className="text-sm font-semibold text-gray-900 hover:text-[#0851A0]"
            >
              {row.name}
            </Link>
            <p className="mt-0.5 truncate text-xs text-gray-500">
              {row.description}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              {row.matchesSent > 0
                ? `${row.matchesSent} match${row.matchesSent === 1 ? "" : "es"} sent so far`
                : "No matches sent yet"}
              {row.lastNotifiedAt && (
                <>
                  {" · last checked "}
                  {new Date(row.lastNotifiedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="text-gray-400"
              title={
                row.cadence === "off" ? "Emails off" : `Emails ${row.cadence}`
              }
            >
              {row.cadence === "off" ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
            </span>

            <select
              value={row.cadence}
              disabled={busyId === row.id}
              onChange={(e) => void setCadence(row, e.target.value as Cadence)}
              className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-700 disabled:opacity-50"
              aria-label={`Email frequency for ${row.name}`}
            >
              {(Object.keys(CADENCE_LABEL) as Cadence[]).map((c) => (
                <option key={c} value={c}>
                  {CADENCE_LABEL[c]}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void remove(row)}
              disabled={busyId === row.id}
              className="rounded-lg border border-gray-200 p-1.5 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
