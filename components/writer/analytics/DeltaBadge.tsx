"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Delta } from "@/lib/analytics/types";

/**
 * Period-over-period change pill.
 *
 * `changePct` is null when the previous window was empty — an infinite increase
 * is not a number worth printing, so we say "new" instead.
 *
 * The arrow plus the sign carries the meaning; colour is a reinforcement, never
 * the only signal.
 */
export function DeltaBadge({
  delta,
  invertGood = false,
}: {
  delta: Delta;
  /** Set when a decrease is the good outcome (e.g. refunds). */
  invertGood?: boolean;
}) {
  if (delta.changePct === null) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold"
        style={{ background: "var(--blue-wash)", color: "var(--td-blue)" }}
      >
        new
      </span>
    );
  }

  if (delta.changePct === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold"
        style={{ background: "var(--paper-2)", color: "var(--ink-soft)" }}
      >
        <Minus className="h-3 w-3" />
        flat
      </span>
    );
  }

  const up = delta.changePct > 0;
  const good = invertGood ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11.5px] font-semibold tabular-nums"
      style={{
        background: good ? "var(--emerald-wash)" : "var(--red-wash)",
        color: good ? "var(--emerald)" : "var(--td-red)",
      }}
      title={`Previous period: ${delta.previous.toLocaleString("en-IN")}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(delta.changePct)}%
    </span>
  );
}
