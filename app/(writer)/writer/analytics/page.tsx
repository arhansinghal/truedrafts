import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { loadWriterAnalytics } from "@/lib/analytics/query";
import { parseRangeKey } from "@/lib/analytics/window";
import { PageHead } from "@/components/writer/Manuscript";
import { AnalyticsDashboard } from "@/components/writer/analytics/AnalyticsDashboard";

export const metadata: Metadata = { title: "Analytics" };

// Every number here is writer-specific and changes as readers browse, so there
// is nothing to cache — render it fresh on every request.
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function WriterAnalyticsPage({ searchParams }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const { range: rawRange } = await searchParams;
  const range = parseRangeKey(rawRange);

  const payload = await loadWriterAnalytics(session.user.id, range);

  return (
    <div className="anim-in mx-auto max-w-[980px] px-11 pb-[70px] pt-10">
      <PageHead
        eyebrow="Analytics"
        title="How your work is performing"
      />
      <p
        className="-mt-4 mb-6 max-w-[62ch] text-[13.5px]"
        style={{ color: "var(--ink-soft)" }}
      >
        Views and preview opens have only been recorded since this dashboard
        shipped, so ranges that reach further back will look quieter than they
        really were. Sales and revenue go all the way back.
      </p>

      <AnalyticsDashboard initial={payload} />
    </div>
  );
}
