import type { YearBucket } from "@/lib/university-insights/stats";

/**
 * Applications per admission year.
 *
 * One series, so no legend — the heading names it. Every bar carries its own
 * count as a direct label, which is also the accessible reading of the chart.
 */
export function YearBars({
  buckets,
  missingYears,
}: {
  buckets: YearBucket[];
  missingYears: number;
}) {
  if (buckets.length === 0) return null;

  const tallest = Math.max(...buckets.map((bucket) => bucket.count));
  // Guard the height ratio: a run of all-zero buckets would otherwise divide by
  // nothing. It can't happen today (a bucket only exists because some year had
  // a row) but the fallback costs nothing.
  const scale = tallest > 0 ? tallest : 1;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">
        When they were admitted
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">
        {buckets.length === 1
          ? "Every application here is from one admission cycle."
          : `Spanning ${buckets[0].year} to ${buckets[buckets.length - 1].year}.`}
      </p>

      <div className="mt-5 flex items-end gap-2" style={{ height: 120 }}>
        {buckets.map((bucket) => {
          const heightPct = (bucket.count / scale) * 100;
          return (
            <div
              key={bucket.year}
              className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${bucket.year}: ${bucket.count}`}
            >
              <span className="text-[11px] font-medium tabular-nums text-gray-500">
                {bucket.count > 0 ? bucket.count : ""}
              </span>
              <div
                className="w-full rounded-t-[4px]"
                style={{
                  // Zero stays flat; anything non-zero keeps a visible stub so
                  // a single sale is not indistinguishable from none.
                  height:
                    bucket.count === 0 ? 2 : `${Math.max(6, heightPct)}%`,
                  background:
                    bucket.count === 0 ? "#e5e7eb" : "rgba(8, 81, 160, 0.75)",
                  minHeight: 2,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-2">
        {buckets.map((bucket) => (
          <span
            key={bucket.year}
            className="min-w-0 flex-1 text-center text-[10.5px] tabular-nums text-gray-400"
          >
            {/* Two digits keeps a decade of labels legible at this width. */}
            &apos;{String(bucket.year).slice(-2)}
          </span>
        ))}
      </div>

      {missingYears > 0 && (
        <p className="mt-3 border-t border-gray-100 pt-2.5 text-[11px] text-gray-400">
          {missingYears} application{missingYears === 1 ? "" : "s"} without an
          admission year recorded {missingYears === 1 ? "is" : "are"} not shown.
        </p>
      )}
    </div>
  );
}
