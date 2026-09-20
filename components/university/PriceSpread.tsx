import { formatCents } from "@/lib/utils";
import type { PriceStats } from "@/lib/university-insights/stats";

/**
 * Price spread as a box plot on a single axis: the interquartile range as a
 * bar, the median as a line through it, whiskers out to the cheapest and
 * dearest listing.
 *
 * One measure, one axis, every value also printed as text underneath — so the
 * picture is a convenience and nothing depends on reading it.
 */
export function PriceSpread({ stats }: { stats: PriceStats }) {
  const { minCents, p25Cents, medianCents, p75Cents, maxCents, meanCents } =
    stats;

  if (
    minCents === null ||
    p25Cents === null ||
    medianCents === null ||
    p75Cents === null ||
    maxCents === null
  ) {
    return null;
  }

  // Everything is positioned as a fraction of the min→max span. When every
  // listing is the same price that span is zero, so fall back to a centred
  // marker instead of dividing by nothing.
  const span = maxCents - minCents;
  const at = (value: number): number =>
    span === 0 ? 50 : ((value - minCents) / span) * 100;

  const boxLeft = at(p25Cents);
  const boxRight = at(p75Cents);
  const boxWidth = Math.max(1.5, boxRight - boxLeft);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">What it costs</h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Half of the applications here are priced between{" "}
        {formatCents(p25Cents)} and {formatCents(p75Cents)}.
      </p>

      <div className="mt-6 mb-2 px-1">
        <div className="relative h-9">
          {/* whisker */}
          <div
            className="absolute top-1/2 h-px w-full -translate-y-1/2"
            style={{ background: "#d1d5db" }}
          />
          {/* interquartile box */}
          <div
            className="absolute top-1/2 h-5 -translate-y-1/2 rounded-[4px]"
            style={{
              left: `${boxLeft}%`,
              width: `${boxWidth}%`,
              background: "rgba(8, 81, 160, 0.16)",
              border: "1px solid rgba(8, 81, 160, 0.35)",
            }}
            title={`${formatCents(p25Cents)} – ${formatCents(p75Cents)}`}
          />
          {/* median */}
          <div
            className="absolute top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${at(medianCents)}%`, background: "#0851A0" }}
            title={`Median ${formatCents(medianCents)}`}
          />
          {/* end caps */}
          {[minCents, maxCents].map((value, i) => (
            <div
              key={i}
              className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${at(value)}%`, background: "#9ca3af" }}
              title={formatCents(value)}
            />
          ))}
        </div>

        <div className="mt-1 flex justify-between text-[11px] text-gray-400">
          <span>{formatCents(minCents)}</span>
          <span>{formatCents(maxCents)}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-gray-100 pt-3 text-xs sm:grid-cols-3">
        {[
          ["Cheapest", minCents],
          ["25th percentile", p25Cents],
          ["Median", medianCents],
          ["75th percentile", p75Cents],
          ["Dearest", maxCents],
          ["Mean", meanCents],
        ].map(([label, value]) =>
          value === null ? null : (
            <div key={label as string} className="flex justify-between gap-2">
              <dt className="text-gray-500">{label}</dt>
              <dd className="font-medium tabular-nums text-gray-900">
                {formatCents(value as number)}
              </dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}
