"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, Eye, ShoppingBag, Sparkles } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { bucketLabel } from "@/lib/analytics/window";
import { describeWindow, peakBucket } from "@/lib/analytics/metrics";
import type { AnalyticsPayload, RangeKey } from "@/lib/analytics/types";
import { TrendChart } from "./TrendChart";
import { FunnelBar } from "./FunnelBar";
import { ListingTable } from "./ListingTable";
import { DeltaBadge } from "./DeltaBadge";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
];

/**
 * The interactive shell around the dashboard.
 *
 * The page server-renders the default 30-day payload so the first paint has real
 * numbers in it; switching range refetches from /api/writer/analytics rather
 * than doing a full navigation, which keeps scroll position and the chart's
 * metric toggle intact.
 */
export function AnalyticsDashboard({
  initial,
}: {
  initial: AnalyticsPayload;
}) {
  const [payload, setPayload] = useState<AnalyticsPayload>(initial);
  const [range, setRange] = useState<RangeKey>(initial.range);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: RangeKey, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/writer/analytics?range=${next}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AnalyticsPayload;
      setPayload(data);
    } catch (err) {
      if (signal.aborted) return;
      console.error("[analytics] range fetch failed", err);
      setError("Couldn't load that range. Try again in a moment.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The server already gave us this range — don't refetch it on mount.
    if (range === initial.range) {
      setPayload(initial);
      return;
    }
    const controller = new AbortController();
    void load(range, controller.signal);
    return () => controller.abort();
  }, [range, initial, load]);

  const peak = peakBucket(payload.trend, "revenueCents");

  return (
    <div>
      {/* Range picker — one row, above everything it filters. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1 rounded-[10px] p-1"
          style={{ background: "var(--paper-2)" }}
        >
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                aria-pressed={active}
                className="rounded-[7px] px-3.5 py-1.5 text-[12.5px] transition-colors"
                style={{
                  fontWeight: active ? 600 : 500,
                  background: active ? "var(--surface)" : "transparent",
                  color: active ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <span className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          {loading
            ? "Loading…"
            : describeWindow(payload.trend.length, payload.granularity)}
        </span>
      </div>

      {error && (
        <div
          className="mb-4 rounded-[10px] px-4 py-3 text-[13px]"
          style={{ background: "var(--red-wash)", color: "var(--td-red)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Headline stats with period-over-period deltas */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <HeadlineCard
          icon={TrendingUp}
          label="Revenue"
          value={formatCents(payload.revenue.current)}
          delta={payload.revenue}
          sub="your share, after platform fee"
        />
        <HeadlineCard
          icon={ShoppingBag}
          label="Sales"
          value={payload.sales.current.toLocaleString("en-IN")}
          delta={payload.sales}
          sub="completed purchases"
        />
        <HeadlineCard
          icon={Eye}
          label="Views"
          value={payload.traffic.current.toLocaleString("en-IN")}
          delta={payload.traffic}
          sub="unique-ish, throttled per reader"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <TrendChart trend={payload.trend} granularity={payload.granularity} />
        <FunnelBar funnel={payload.funnel} />
      </div>

      {peak && (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-[12px] px-4 py-3"
          style={{ background: "var(--blue-wash)" }}
        >
          <Sparkles
            className="h-[15px] w-[15px] shrink-0"
            style={{ color: "var(--td-blue)" }}
          />
          <span className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Your best stretch was{" "}
            <strong style={{ color: "var(--ink)" }}>
              {bucketLabel(peak.key, payload.granularity)}
            </strong>{" "}
            — {formatCents(peak.revenueCents)} from {peak.purchases}{" "}
            {peak.purchases === 1 ? "sale" : "sales"}.
          </span>
        </div>
      )}

      <div className="mb-3">
        <h2
          className="serif text-[19px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          Listing performance
        </h2>
      </div>
      <ListingTable rows={payload.listings} />
    </div>
  );
}

function HeadlineCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  delta: AnalyticsPayload["revenue"];
  sub: string;
}) {
  return (
    <div
      className="rounded-[14px] p-[18px]"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: "var(--ink-faint)" }}
        >
          <Icon className="h-[15px] w-[15px]" />
          {label}
        </span>
        <DeltaBadge delta={delta} />
      </div>
      <div
        className="serif mt-2 text-[27px] font-semibold"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
        {sub}
      </div>
    </div>
  );
}
