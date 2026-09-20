import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { loadUniversityInsights } from "@/lib/university-insights/query";
import { hasEnoughForDistributions } from "@/lib/university-insights/stats";
import { InsightStrip } from "@/components/university/InsightStrip";
import { PriceSpread } from "@/components/university/PriceSpread";
import { YearBars } from "@/components/university/YearBars";
import { ThemeList } from "@/components/university/ThemeList";

interface Props {
  params: Promise<{ slug: string }>;
}

// Aggregates over a whole school change only when an application is approved,
// which is rare. An hour of staleness is invisible to a reader and saves the
// scan on every visit.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const payload = await loadUniversityInsights(slug);
  if (!payload) return {};

  const { university, insights } = payload;
  return {
    title: `${university.name} application insights`,
    description: `What ${insights.total} successful ${university.name} applications have in common: themes, prices, supplemental counts and admission years.`,
  };
}

export default async function UniversityInsightsPage({ params }: Props) {
  const { slug } = await params;
  const payload = await loadUniversityInsights(slug);
  if (!payload) notFound();

  const { university, insights, related } = payload;
  const showDistributions = hasEnoughForDistributions(insights.total);

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <div className="border-b border-gray-100 bg-white px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href={`/university/${university.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {university.name}
          </Link>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
              <Image
                src={`/uni_logos/${university.slug}.png`}
                alt={university.name}
                width={56}
                height={56}
                className="h-[76%] w-[76%] object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {university.name} application insights
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                {[university.city, university.state].filter(Boolean).join(", ") ||
                  "Aggregated across every published application"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {insights.total === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <p className="text-sm font-medium text-gray-700">
              Nothing published for {university.name} yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
              As soon as an admitted student publishes their application here,
              this page will fill in.
            </p>
            <Link
              href="/applications"
              className="mt-4 inline-block rounded-lg bg-[#0851A0] px-4 py-2 text-sm font-semibold text-white"
            >
              Browse every school
            </Link>
          </div>
        ) : (
          <>
            <InsightStrip insights={insights} />

            {showDistributions ? (
              <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <PriceSpread stats={insights.price} />
                <YearBars
                  buckets={insights.years}
                  missingYears={insights.missingYears}
                />
                <div className="lg:col-span-2">
                  <ThemeList
                    tags={insights.tags}
                    majors={insights.majors}
                    universitySlug={university.slug}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500">
                {insights.total} application
                {insights.total === 1 ? "" : "s"} is too small a sample to
                describe as a distribution — a median of three numbers is noise
                dressed up as an insight. Once a handful more are published,
                price spread, themes and admission years will appear here.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/applications?university=${university.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0851A0] px-4 py-2 text-sm font-semibold text-white"
              >
                Read {insights.total} {university.name} application
                {insights.total === 1 ? "" : "s"}
                <ArrowRight className="h-4 w-4" />
              </Link>

              {insights.demand.totalViews > 0 && (
                <span className="text-xs text-gray-400">
                  {insights.demand.totalViews.toLocaleString("en-IN")} views ·{" "}
                  {insights.demand.totalPurchases.toLocaleString("en-IN")}{" "}
                  unlocked
                </span>
              )}
            </div>
          </>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-gray-900">
              Similar schools with applications published
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((other) => (
                <Link
                  key={other.id}
                  href={`/university/${other.slug}/insights`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-[#0851A0]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100">
                    <Image
                      src={`/uni_logos/${other.slug}.png`}
                      alt={other.name}
                      width={36}
                      height={36}
                      className="h-[76%] w-[76%] object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-900">
                      {other.name}
                    </div>
                    <div className="text-[11.5px] text-gray-400">
                      {other.applicationCount} application
                      {other.applicationCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
