"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { ListingRow } from "@/lib/analytics/types";

type SortKey = "revenueCents" | "views" | "previewOpens" | "purchases" | "conversionPct";

const COLUMNS: { key: SortKey; label: string; numeric: true }[] = [
  { key: "views", label: "Views", numeric: true },
  { key: "previewOpens", label: "Previews", numeric: true },
  { key: "purchases", label: "Sales", numeric: true },
  { key: "conversionPct", label: "Conv.", numeric: true },
  { key: "revenueCents", label: "Revenue", numeric: true },
];

function statusStyle(status: string): { bg: string; fg: string } {
  if (status === "approved") {
    return { bg: "var(--emerald-wash)", fg: "var(--emerald)" };
  }
  if (status === "rejected") {
    return { bg: "var(--red-wash)", fg: "var(--td-red)" };
  }
  if (status === "archived") {
    return { bg: "var(--paper-2)", fg: "var(--ink-soft)" };
  }
  return { bg: "var(--amber-wash)", fg: "var(--amber)" };
}

/**
 * Per-listing performance, sorted by whichever column the writer clicks.
 *
 * This doubles as the accessible table view for the trend chart above — every
 * number in the dashboard is readable here as text.
 */
export function ListingTable({ rows }: { rows: ListingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenueCents");

  const sorted = [...rows].sort((a, b) => {
    const diff = b[sortKey] - a[sortKey];
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });

  if (rows.length === 0) {
    return (
      <div
        className="rounded-[14px] p-8 text-center"
        style={{
          background: "var(--surface)",
          border: "1px dashed var(--line)",
        }}
      >
        <p className="text-[13.5px]" style={{ color: "var(--ink-soft)" }}>
          You have no listings yet. Publish an application and its performance
          will show up here.
        </p>
        <Link
          href="/writer/essays/new"
          className="mt-3 inline-block text-[13px] font-semibold"
          style={{ color: "var(--td-blue)" }}
        >
          Publish an application →
        </Link>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[14px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr style={{ background: "var(--paper-2)" }}>
              <th
                className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--ink-faint)" }}
                scope="col"
              >
                Listing
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-right text-[11.5px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <button
                    type="button"
                    onClick={() => setSortKey(col.key)}
                    className="inline-flex items-center gap-1"
                    style={{
                      color:
                        sortKey === col.key
                          ? "var(--td-blue)"
                          : "var(--ink-faint)",
                    }}
                    aria-label={`Sort by ${col.label}`}
                  >
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const tone = statusStyle(row.status);
              return (
                <tr
                  key={row.id}
                  style={{ borderTop: "1px solid var(--line-soft)" }}
                >
                  <td className="px-4 py-3">
                    <div
                      className="text-[13.5px] font-semibold"
                      style={{ color: "var(--ink)" }}
                    >
                      {row.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className="text-[12px]"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        {row.universityName}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold"
                        style={{ background: tone.bg, color: tone.fg }}
                      >
                        {row.status}
                      </span>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 text-right text-[13px] tabular-nums"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {row.views.toLocaleString("en-IN")}
                  </td>
                  <td
                    className="px-4 py-3 text-right text-[13px] tabular-nums"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {row.previewOpens.toLocaleString("en-IN")}
                  </td>
                  <td
                    className="px-4 py-3 text-right text-[13px] tabular-nums"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {row.purchases.toLocaleString("en-IN")}
                  </td>
                  <td
                    className="px-4 py-3 text-right text-[13px] tabular-nums"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {row.conversionPct}%
                  </td>
                  <td
                    className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums"
                    style={{ color: "var(--ink)" }}
                  >
                    {formatCents(row.revenueCents)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
