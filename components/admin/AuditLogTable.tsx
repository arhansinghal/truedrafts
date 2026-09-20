"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Shield } from "lucide-react";
import { formatValue, type FieldChange } from "@/lib/audit/redact";

type Entry = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string | null;
  ipAddress: string | null;
  createdAt: string;
  changes: FieldChange[];
  summary: string;
};

type Payload = {
  entries: Entry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  actions: string[];
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `application.approve` → `Application approve`. */
function prettyAction(action: string): string {
  const words = action.replace(/[._]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AuditLogTable() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (action) params.set("action", action);

        const res = await fetch(`/api/admin/audit?${params.toString()}`, {
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setPayload((await res.json()) as Payload);
      } catch (err) {
        if (signal.aborted) return;
        console.error("[audit] fetch failed", err);
        setError("Couldn't load the audit log.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, action],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const entries = payload?.entries ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <Shield className="h-5 w-5 text-gray-400" />
            Audit log
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Every admin action, who took it, and what changed.
          </p>
        </div>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            // A narrower filter almost certainly has fewer pages than the one
            // we were on; going back to the first is the only safe landing.
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {(payload?.actions ?? []).map((a) => (
            <option key={a} value={a}>
              {prettyAction(a)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-8 px-3 py-3" />
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Who</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Changed</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  {action
                    ? "No entries for that action."
                    : "Nothing recorded yet."}
                </td>
              </tr>
            )}

            {!loading &&
              entries.map((entry) => {
                const isOpen = expanded.has(entry.id);
                return (
                  <tr key={entry.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => toggle(entry.id)}
                        disabled={entry.changes.length === 0}
                        className="text-gray-400 disabled:opacity-30"
                        aria-label={isOpen ? "Hide changes" : "Show changes"}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatWhen(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-900">
                        {entry.actorEmail}
                      </div>
                      {entry.ipAddress && (
                        <div className="mt-0.5 font-mono text-[10.5px] text-gray-400">
                          {entry.ipAddress}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-900">
                        {entry.targetLabel ?? entry.targetId ?? "—"}
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-gray-400">
                        {entry.targetType}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{entry.summary}</div>
                      {isOpen && entry.changes.length > 0 && (
                        <dl className="mt-2 space-y-1.5 border-l-2 border-gray-100 pl-3">
                          {entry.changes.map((change) => (
                            <div key={change.path} className="text-[11.5px]">
                              <dt className="font-mono text-gray-500">
                                {change.path}
                              </dt>
                              <dd className="text-gray-900">
                                <span className="text-red-500 line-through">
                                  {formatValue(change.before)}
                                </span>
                                {" → "}
                                <span className="text-emerald-700">
                                  {formatValue(change.after)}
                                </span>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Newer
        </button>

        <span className="text-xs text-gray-400">Page {page}</span>

        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          disabled={!payload?.hasMore || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
        >
          Older
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
