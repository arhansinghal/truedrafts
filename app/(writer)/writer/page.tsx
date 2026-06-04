import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, writerEarnings, applicationDrafts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Image from "next/image";
import { Plus, ShoppingBag, ArrowRight, TrendingUp, Wallet, Files } from "lucide-react";
import { formatCents, timeAgo } from "@/lib/utils";
import { PageHead, StatCard, StatusPill, SectionTitle } from "@/components/writer/Manuscript";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Writer Dashboard" };

const STEP_LABELS = ["Application Setup", "Common App Essay", "Supplemental Essays", "Review & Submit"];

export default async function WriterOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const [myApplications, earnings, drafts] = await Promise.all([
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, session.user.id),
      // Light columns only — never pull the insightBriefEmbedding vector or full
      // essay text into a list view (see perf notes on the Browse page).
      columns: {
        id: true, title: true, status: true, submittedCommonApp: true,
        numSupplementals: true, purchases: true, createdAt: true,
        rejectionNote: true, admittedYear: true,
      },
      with: { university: { columns: { name: true, slug: true } } },
      orderBy: [desc(collegeApplications.createdAt)],
      limit: 5,
    }),
    db.query.writerEarnings.findFirst({
      where: eq(writerEarnings.writerId, session.user.id),
    }),
    db.query.applicationDrafts.findMany({
      where: eq(applicationDrafts.writerId, session.user.id),
      orderBy: [desc(applicationDrafts.updatedAt)],
    }),
  ]);

  const totalApplications = myApplications.length;
  const totalSales = myApplications.reduce((s, a) => s + (a.purchases ?? 0), 0);
  const liveCount = myApplications.filter((a) => a.status === "approved").length;
  const availableCents = earnings?.availableCents ?? 0;
  const totalEarnedCents = earnings?.totalEarnedCents ?? 0;
  const pendingCents = earnings?.pendingCents ?? 0;

  return (
    <div className="anim-in mx-auto max-w-[980px] px-11 pb-[70px] pt-10">
      <PageHead
        eyebrow={`Welcome back, ${session.user.name.split(" ")[0]}`}
        title="Your studio at a glance"
        right={
          <Link
            href="/writer/essays/new"
            className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] text-sm font-semibold text-white"
            style={{ background: "var(--td-blue)" }}
          >
            <Plus className="h-4 w-4" /> Publish application
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="mb-[22px] grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={TrendingUp} tone="emerald" label="Total earned" value={formatCents(totalEarnedCents)} sub="lifetime, after platform fee" />
        <StatCard icon={Wallet} tone="blue" label="Available" value={formatCents(availableCents)} actionLabel="Request payout" actionHref="/writer/payout" />
        <StatCard icon={Files} label="Live applications" value={liveCount} sub={`${totalApplications} total`} />
        <StatCard icon={ShoppingBag} label="Total sales" value={totalSales} sub="across all applications" />
      </div>

      {/* Earnings ribbon */}
      <div
        className="relative mb-[30px] overflow-hidden rounded-[14px]"
        style={{ background: "var(--ink)", color: "var(--paper)" }}
      >
        <div className="relative flex items-center gap-6 px-6 py-[22px]">
          <div className="tex-dot absolute inset-0 opacity-[0.15]" />
          <div className="relative flex-1">
            <div className="eyebrow" style={{ color: "#9DB4D4" }}>Balance overview</div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="serif text-[32px] font-semibold">{formatCents(availableCents)}</span>
              <span className="text-[13px] font-semibold" style={{ color: "#7FE3B9" }}>
                available now
              </span>
            </div>
            <div className="mt-1 text-[12.5px]" style={{ color: "#9DB4D4" }}>
              Pending {formatCents(pendingCents)} · Lifetime {formatCents(totalEarnedCents)}
            </div>
          </div>
          {/* mini sparkline (illustrative) */}
          <div className="relative flex h-12 items-end gap-[5px]">
            {[28, 34, 30, 46, 40, 58, 52, 70, 64, 82].map((h, i) => (
              <span
                key={i}
                className="w-[7px] rounded-[3px]"
                style={{ height: h + "%", background: i >= 8 ? "#7FE3B9" : "rgba(255,255,255,.28)" }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* In-progress applications (drafts, incl. ones seeded from onboarding) */}
      {drafts.length > 0 && (
        <div className="mb-[30px]">
          <div className="mb-3.5">
            <SectionTitle>In progress</SectionTitle>
          </div>
          <div className="flex flex-col gap-2.5">
            {drafts.map((draft) => {
              const step = draft.currentStep ?? 1;
              const stepLabel = STEP_LABELS[step - 1] ?? STEP_LABELS[0];
              const progress = Math.round((step / 4) * 100);
              return (
                <div
                  key={draft.id}
                  className="flex items-center gap-4 rounded-[14px] p-4"
                  style={{ background: "var(--blue-wash)", border: "1px solid var(--blue-line)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                      {draft.universityName ?? "Untitled application"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="h-[5px] w-[150px] overflow-hidden rounded-full" style={{ background: "rgba(8,81,160,.16)" }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--td-blue)" }} />
                      </div>
                      <span className="text-xs font-semibold" style={{ color: "var(--td-blue)" }}>{stepLabel}</span>
                    </div>
                  </div>
                  <Link
                    href={`/writer/essays/new?draft=${draft.id}`}
                    className="shrink-0 rounded-[10px] px-[15px] py-2 text-[13px] font-semibold text-white"
                    style={{ background: "var(--td-blue)" }}
                  >
                    Continue →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent applications */}
      <div className="mb-3.5 flex items-center justify-between">
        <SectionTitle>Recent applications</SectionTitle>
        <Link
          href="/writer/essays"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold"
          style={{ color: "var(--td-blue)" }}
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {myApplications.length === 0 ? (
        <div
          className="rounded-[14px] border border-dashed p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="mb-1 font-semibold" style={{ color: "var(--ink)" }}>
            Nothing here yet
          </p>
          <p className="mb-4 text-sm" style={{ color: "var(--ink-faint)" }}>
            Publish your first application to start earning.
          </p>
          <Link
            href="/writer/essays/new"
            className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] text-sm font-semibold text-white"
            style={{ background: "var(--td-blue)" }}
          >
            <Plus className="h-4 w-4" /> Publish application
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {myApplications.slice(0, 3).map((app) => (
            <AppRow key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

// Inline server-rendered application row (matches design AppRow).
function AppRow({
  app,
}: {
  app: {
    id: string;
    title: string;
    status: string;
    submittedCommonApp: boolean | null;
    numSupplementals: number | null;
    purchases: number | null;
    createdAt: Date | null;
    rejectionNote?: string | null;
    admittedYear?: number | null;
    university: { name: string; slug: string };
  };
}) {
  const essayCount = (app.submittedCommonApp ? 1 : 0) + (app.numSupplementals ?? 0);

  return (
    <div
      className="flex items-center gap-[15px] rounded-[14px] p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
        style={{ background: "#fff", border: "1px solid var(--line)" }}
      >
        <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={36} height={36} className="h-[76%] w-[76%] object-contain" unoptimized />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[9px]">
          <span className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
            {app.title}
          </span>
          <StatusPill status={app.status} />
        </div>
        <div className="eyebrow mt-1">
          {app.university.name} · {app.admittedYear ?? "—"} · {essayCount} essay{essayCount !== 1 ? "s" : ""}
        </div>
        {app.status === "rejected" && app.rejectionNote && (
          <div
            className="mt-2 rounded-[9px] px-[11px] py-2 text-[12.5px] leading-[1.45]"
            style={{ color: "var(--td-red)", background: "var(--red-wash)", border: "1px solid #ECCDC9" }}
          >
            {app.rejectionNote}
          </div>
        )}
      </div>
      {app.status === "approved" ? (
        <div className="shrink-0 text-right">
          <div className="mono text-[15px] font-semibold" style={{ color: "var(--emerald)" }}>
            {(app.purchases ?? 0)} <span className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>sales</span>
          </div>
        </div>
      ) : app.status === "pending" ? (
        <div className="shrink-0 text-right text-[12px]" style={{ color: "var(--ink-faint)" }}>
          In review · 24–48h
        </div>
      ) : null}
    </div>
  );
}
