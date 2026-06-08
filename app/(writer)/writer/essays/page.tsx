import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, applicationDrafts } from "@/lib/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import Image from "next/image";
import { DeleteDraftButton } from "@/components/writer/DeleteDraftButton";
import { DeleteApplicationButton } from "@/components/writer/DeleteApplicationButton";
import { PageHead, StatusPill } from "@/components/writer/Manuscript";
import { Plus, ShoppingBag, Eye } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Applications" };

const STEP_LABELS = ["Application Setup", "Common App Essay", "Supplemental Essays", "Review & Submit"];

export default async function WriterApplicationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const [myApplications, myDrafts] = await Promise.all([
    db.query.collegeApplications.findMany({
      // Exclude soft-deleted ("archived") listings — buyers keep access, but
      // the writer no longer sees them here. See DELETE /api/writer/applications/[id].
      where: and(
        eq(collegeApplications.writerId, session.user.id),
        ne(collegeApplications.status, "archived"),
      ),
      // Light columns only — keep the heavyweight vector / essay text off the wire.
      columns: {
        id: true, title: true, status: true, submittedCommonApp: true,
        numSupplementals: true, admittedYear: true, views: true, purchases: true,
        rejectionNote: true, createdAt: true, major: true,
      },
      with: { university: { columns: { name: true, slug: true } } },
      orderBy: [desc(collegeApplications.createdAt)],
    }),
    db.query.applicationDrafts.findMany({
      where: eq(applicationDrafts.writerId, session.user.id),
      orderBy: [desc(applicationDrafts.updatedAt)],
    }),
  ]);

  return (
    <div className="anim-in mx-auto max-w-[880px] px-11 pb-[70px] pt-10">
      <PageHead
        eyebrow="Manage"
        title="My Applications"
        sub={`${myApplications.length} submitted · ${myDrafts.length} in progress`}
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

      {/* ── In-progress drafts ── */}
      {myDrafts.length > 0 && (
        <div className="mb-7">
          <div className="eyebrow mb-2.5">In progress</div>
          <div className="flex flex-col gap-2">
            {myDrafts.map((draft) => {
              const stepLabel = STEP_LABELS[(draft.currentStep ?? 1) - 1] ?? "Application Setup";
              const progress = Math.round(((draft.currentStep ?? 1) / 4) * 100);
              return (
                <div
                  key={draft.id}
                  className="flex items-center gap-4 rounded-[14px] p-4"
                  style={{ background: "var(--blue-wash)", border: "1px solid var(--blue-line)" }}
                >
                  <div
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                    style={{ background: "#fff", border: "1px solid var(--line)" }}
                  >
                    {draft.universitySlug ? (
                      <Image src={`/uni_logos/${draft.universitySlug}.png`} alt={draft.universityName ?? ""} width={32} height={32} className="h-[76%] w-[76%] object-contain" unoptimized />
                    ) : (
                      <div className="h-6 w-6 rounded bg-gray-200" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
                      {draft.universityName ?? "Untitled Application"}
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
                    className="shrink-0 rounded-[10px] px-[13px] py-2 text-[13px] font-semibold text-white"
                    style={{ background: "var(--td-blue)" }}
                  >
                    Continue →
                  </Link>
                  <DeleteDraftButton draftId={draft.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Submitted applications ── */}
      {myApplications.length === 0 ? (
        <div
          className="rounded-[14px] border border-dashed p-10 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="mb-1 font-semibold" style={{ color: "var(--ink)" }}>Nothing here yet</p>
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            Publish your first application to start earning.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {myApplications.map((app) => {
            const essayCount = (app.submittedCommonApp ? 1 : 0) + (app.numSupplementals ?? 0);
            return (
              <div
                key={app.id}
                className="rounded-[14px] p-5"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                    style={{ background: "#fff", border: "1px solid var(--line)" }}
                  >
                    <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={40} height={40} className="h-[76%] w-[76%] object-contain" unoptimized />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>{app.title}</h3>
                      <StatusPill status={app.status} />
                    </div>

                    <div className="eyebrow">
                      {app.university.name} · {app.admittedYear} · {essayCount} essay{essayCount !== 1 ? "s" : ""}
                      {app.major && ` · ${app.major}`}
                      {app.submittedCommonApp && " · incl. Common App"}
                    </div>

                    {app.status === "rejected" && app.rejectionNote && (
                      <p
                        className="mt-2 rounded-[9px] px-3 py-2 text-xs"
                        style={{ color: "var(--td-red)", background: "var(--red-wash)", border: "1px solid #ECCDC9" }}
                      >
                        Rejection reason: {app.rejectionNote}
                      </p>
                    )}

                    {app.status === "approved" && (
                      <div className="mt-2 flex items-center gap-4 text-xs" style={{ color: "var(--ink-faint)" }}>
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{app.views ?? 0} views</span>
                        <span className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />{app.purchases ?? 0} sales</span>
                      </div>
                    )}

                    <p className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>Submitted {timeAgo(app.createdAt)}</p>
                  </div>

                  <DeleteApplicationButton
                    applicationId={app.id}
                    title={app.title}
                    isLive={app.status === "approved"}
                    hasBuyers={(app.purchases ?? 0) > 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
