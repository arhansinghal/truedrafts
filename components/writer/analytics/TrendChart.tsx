"use client";

import { useMemo, useState } from "react";
import { formatCents } from "@/lib/utils";
import { bucketLabel } from "@/lib/analytics/window";
import type { Granularity, TrendPoint } from "@/lib/analytics/types";

type MetricKey = "revenueCents" | "views" | "previewOpens" | "purchases";

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "revenueCents", label: "Revenue" },
  { key: "views", label: "Views" },
  { key: "previewOpens", label: "Preview opens" },
  { key: "purchases", label: "Sales" },
];

/** Plot geometry. The SVG scales with its container via a viewBox. */
const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 30, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function formatValue(metric: MetricKey, value: number): string {
  return metric === "revenueCents" ? formatCents(value) : String(value);
}

/**
 * Axis tick values: a rounded ceiling plus the midpoints between it and zero.
 * Four gridlines is enough to read a shape without turning into graph paper.
 */
function niceTicks(max: number, metric: MetricKey): number[] {
  if (max <= 0) return [0];
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const ceiling = Math.ceil(max / magnitude) * magnitude;
  const steps = metric === "revenueCents" ? 4 : Math.min(4, Math.max(1, ceiling));
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    out.push(Math.round((ceiling / steps) * i));
  }
  return Array.from(new Set(out));
}

/**
 * Single-measure trend. One series at a time, switched by the toggle above the
 * plot — deliberately not two y-axes, which would make the two lines' crossings
 * mean nothing.
 */
export function TrendChart({
  trend,
  granularity,
}: {
  trend: TrendPoint[];
  granularity: Granularity;
}) {
  const [metric, setMetric] = useState<MetricKey>("revenueCents");
  const [hover, setHover] = useState<number | null>(null);

  const values = useMemo(() => trend.map((p) => p[metric]), [trend, metric]);
  const max = useMemo(() => Math.max(0, ...values), [values]);
  const ticks = useMemo(() => niceTicks(max, metric), [max, metric]);
  const axisMax = ticks[ticks.length - 1] || 1;

  const xFor = (i: number) => {
    if (trend.length <= 1) return PAD.left + PLOT_W / 2;
    return PAD.left + (PLOT_W * i) / (trend.length - 1);
  };
  const yFor = (v: number) => PAD.top + PLOT_H - (PLOT_H * v) / axisMax;

  const linePath = useMemo(() => {
    if (values.length === 0) return "";
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(v).toFixed(2)}`)
      .join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, axisMax]);

  const areaPath = useMemo(() => {
    if (!linePath) return "";
    const baseline = PAD.top + PLOT_H;
    return `${linePath} L${xFor(values.length - 1).toFixed(2)},${baseline} L${xFor(0).toFixed(2)},${baseline} Z`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linePath, values.length]);

  // Show at most eight x labels so they never collide on a 365-day range.
  const labelStride = Math.max(1, Math.ceil(trend.length / 8));

  const total = values.reduce((sum, v) => sum + v, 0);
  const active = METRICS.find((m) => m.key === metric)!;
  const hovered = hover !== null ? trend[hover] : null;

  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow" style={{ color: "var(--ink-faint)" }}>
            {active.label} over time
          </div>
          <div
            className="serif mt-1 text-[26px] font-semibold"
            style={{ color: "var(--ink)" }}
          >
            {formatValue(metric, total)}
          </div>
        </div>

        <div
          className="flex flex-wrap gap-1 rounded-[10px] p-1"
          style={{ background: "var(--paper-2)" }}
          role="tablist"
          aria-label="Choose a metric"
        >
          {METRICS.map((m) => {
            const isActive = m.key === metric;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setMetric(m.key)}
                className="rounded-[7px] px-3 py-1.5 text-[12.5px] transition-colors"
                style={{
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? "var(--surface)" : "transparent",
                  color: isActive ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: isActive ? "var(--shadow-sm)" : "none",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 240 }}
          role="img"
          aria-label={`${active.label} by ${granularity}`}
          onMouseLeave={() => setHover(null)}
        >
          {/* Recessive gridlines + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="var(--line-soft)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={yFor(t) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--ink-faint)"
              >
                {formatValue(metric, t)}
              </text>
            </g>
          ))}

          {areaPath && (
            <path d={areaPath} fill="var(--blue-wash)" stroke="none" opacity={0.9} />
          )}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--td-blue)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Crosshair for the hovered bucket */}
          {hovered && hover !== null && (
            <>
              <line
                x1={xFor(hover)}
                x2={xFor(hover)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--blue-line)"
                strokeWidth={1}
              />
              <circle
                cx={xFor(hover)}
                cy={yFor(hovered[metric])}
                r={4.5}
                fill="var(--td-blue)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </>
          )}

          {/* x labels, thinned so they cannot collide */}
          {trend.map((point, i) =>
            i % labelStride === 0 ? (
              <text
                key={point.key}
                x={xFor(i)}
                y={H - 10}
                textAnchor="middle"
                fontSize={11}
                fill="var(--ink-faint)"
              >
                {new Date(point.key).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
            ) : null,
          )}

          {/* Invisible hit targets — wider than the marks, per bucket */}
          {trend.map((point, i) => (
            <rect
              key={`hit-${point.key}`}
              x={xFor(i) - PLOT_W / Math.max(trend.length, 1) / 2}
              y={PAD.top}
              width={PLOT_W / Math.max(trend.length, 1)}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute z-10 rounded-[9px] px-3 py-2 text-[12px]"
            style={{
              left: `${(xFor(hover) / W) * 100}%`,
              top: 0,
              transform: "translateX(-50%)",
              background: "var(--ink)",
              color: "var(--paper)",
              boxShadow: "var(--shadow)",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ opacity: 0.75 }}>
              {bucketLabel(hovered.key, granularity)}
            </div>
            <div className="font-semibold">
              {formatValue(metric, hovered[metric])}
            </div>
          </div>
        )}
      </div>

      {total === 0 && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          No {active.label.toLowerCase()} recorded in this range yet.
        </p>
      )}
    </div>
  );
}
