"use client";

import { Eye, BookOpen, ShoppingBag } from "lucide-react";
import type { Funnel } from "@/lib/analytics/types";

type Stage = {
  label: string;
  value: number;
  icon: typeof Eye;
  /** Conversion from the stage above, as a whole percentage. */
  fromPrevious: number | null;
  hint: string;
};

/**
 * View → preview → purchase, as three stacked bars scaled against the widest
 * stage. Each step carries its own conversion rate so a writer can see exactly
 * where readers drop off.
 *
 * Bars are labelled directly rather than via a legend: there is one measure
 * (people), and the stage name is the identity.
 */
export function FunnelBar({ funnel }: { funnel: Funnel }) {
  const stages: Stage[] = [
    {
      label: "Views",
      value: funnel.views,
      icon: Eye,
      fromPrevious: null,
      hint: "Landed on one of your listings",
    },
    {
      label: "Preview opens",
      value: funnel.previewOpens,
      icon: BookOpen,
      fromPrevious: funnel.viewToPreviewPct,
      hint: "Opened the free preview",
    },
    {
      label: "Sales",
      value: funnel.purchases,
      icon: ShoppingBag,
      fromPrevious: funnel.previewToPurchasePct,
      hint: "Paid for the full application",
    },
  ];

  const widest = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div
      className="rounded-[14px] p-5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <div className="eyebrow" style={{ color: "var(--ink-faint)" }}>
          Reader funnel
        </div>
        <div className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          {funnel.overallConversionPct}% view → sale
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3.5">
        {stages.map((stage) => {
          const Icon = stage.icon;
          // Floor the rendered width so a non-zero stage never disappears.
          const widthPct =
            stage.value === 0 ? 0 : Math.max(4, (stage.value / widest) * 100);

          return (
            <div key={stage.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span
                  className="flex items-center gap-2 text-[13px] font-semibold"
                  style={{ color: "var(--ink)" }}
                >
                  <Icon
                    className="h-[15px] w-[15px]"
                    style={{ color: "var(--ink-faint)" }}
                  />
                  {stage.label}
                </span>
                <span className="flex items-baseline gap-2">
                  <span
                    className="text-[14px] font-semibold tabular-nums"
                    style={{ color: "var(--ink)" }}
                  >
                    {stage.value.toLocaleString("en-IN")}
                  </span>
                  {stage.fromPrevious !== null && (
                    <span
                      className="text-[12px] tabular-nums"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      {stage.fromPrevious}%
                    </span>
                  )}
                </span>
              </div>

              <div
                className="h-[10px] w-full overflow-hidden rounded-[5px]"
                style={{ background: "var(--paper-2)" }}
              >
                <div
                  className="h-full rounded-[5px]"
                  style={{
                    width: `${widthPct}%`,
                    background: "var(--td-blue)",
                  }}
                />
              </div>

              <p
                className="mt-1 text-[11.5px]"
                style={{ color: "var(--ink-faint)" }}
              >
                {stage.hint}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
