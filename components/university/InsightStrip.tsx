import { FileText, IndianRupee, Layers, TrendingUp } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { UniversityInsights } from "@/lib/university-insights/stats";

/**
 * The four numbers worth reading first. Each one is a plain figure with a
 * caption — a stat tile, not a chart, because there is no shape to see in a
 * single value.
 *
 * A tile whose value is unknowable shows an em dash rather than a zero: "no
 * applications priced yet" and "priced at ₹0" are different claims.
 */
export function InsightStrip({ insights }: { insights: UniversityInsights }) {
  const tiles = [
    {
      icon: FileText,
      label: "Applications",
      value: insights.total.toLocaleString("en-IN"),
      caption:
        insights.total === 1 ? "published here" : "published for this school",
    },
    {
      icon: IndianRupee,
      label: "Typical price",
      value:
        insights.price.medianCents === null
          ? "—"
          : formatCents(insights.price.medianCents),
      caption:
        insights.price.medianCents === null
          ? "nothing published yet"
          : "median across every listing",
    },
    {
      icon: Layers,
      label: "Supplementals",
      value:
        insights.shape.meanSupplementals === null
          ? "—"
          : insights.shape.meanSupplementals.toFixed(1),
      caption: "average per application",
    },
    {
      icon: TrendingUp,
      label: "Personal statement",
      value:
        insights.shape.commonAppSharePct === null
          ? "—"
          : `${insights.shape.commonAppSharePct}%`,
      caption: "include a Common App essay",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <Icon className="h-3.5 w-3.5" />
              {tile.label}
            </span>
            <div className="mt-1.5 text-2xl font-semibold text-gray-900">
              {tile.value}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">{tile.caption}</p>
          </div>
        );
      })}
    </div>
  );
}
