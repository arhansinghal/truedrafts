import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, applicationDrafts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Image from "next/image";
import { DeleteDraftButton } from "@/components/writer/DeleteDraftButton";
import { Button } from "@/components/ui/button";
import { PenLine, Clock, CheckCircle, XCircle, ShoppingBag, Eye, FileText } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Applications" };

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  pending:  { label: "Pending Approval", style: "bg-[#e8f1fa] text-[#0851A0] border-[#0851A0]/20",   icon: Clock },
  approved: { label: "Live",             style: "bg-green-50 text-green-700 border-green-200",        icon: CheckCircle },
  rejected: { label: "Rejected",         style: "bg-red-50 text-red-700 border-red-200",              icon: XCircle },
  archived: { label: "Archived",         style: "bg-gray-100 text-gray-500 border-gray-200",          icon: FileText },
};

const STEP_LABELS = ["Application Setup", "Common App Essay", "Supplemental Essays", "Review & Submit"];

export default async function WriterApplicationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const [myApplications, myDrafts] = await Promise.all([
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, session.user.id),
      with: { university: true },
      orderBy: [desc(collegeApplications.createdAt)],
    }),
    db.query.applicationDrafts.findMany({
      where: eq(applicationDrafts.writerId, session.user.id),
      orderBy: [desc(applicationDrafts.updatedAt)],
    }),
  ]);

  return (
    <div className="max-w-4xl">

      {/* ── In-progress drafts ── */}
      {myDrafts.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#0851A0]/60">In Progress</span>
            <div className="flex-1 h-px bg-[#0851A0]/10" />
          </div>
          <div className="space-y-2">
            {myDrafts.map((draft) => {
              const stepLabel = STEP_LABELS[(draft.currentStep ?? 1) - 1] ?? "Application Setup";
              const progress = Math.round(((draft.currentStep ?? 1) / 4) * 100);
              return (
                <div key={draft.id} className="flex items-center gap-4 rounded-xl border border-[#0851A0]/15 bg-[#f0f5ff] p-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {draft.universitySlug ? (
                      <Image src={`/uni_logos/${draft.universitySlug}.png`} alt={draft.universityName ?? ""} width={32} height={32} className="object-contain p-0.5" unoptimized />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">{draft.universityName ?? "Untitled Application"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-[160px] h-1.5 rounded-full bg-[#0851A0]/15 overflow-hidden">
                        <div className="h-full rounded-full bg-[#0851A0]" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-[#0851A0] font-medium">{stepLabel}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Last saved {new Date(draft.updatedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/writer/essays/new?draft=${draft.id}`}>
                      <Button size="sm" className="bg-[#0851A0] text-white hover:bg-[#063d85] gap-1.5" style={{ background: "#0851A0" }}>
                        Continue →
                      </Button>
                    </Link>
                    <DeleteDraftButton draftId={draft.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-500 text-sm mt-1">
            {myApplications.length} submitted &middot; {myDrafts.length} in progress
          </p>
        </div>
        <Link href="/writer/essays/new">
          <Button className="gap-2 bg-[#0851A0] text-white hover:bg-[#063d85]" style={{ background: "#0851A0" }}>
            <PenLine className="h-4 w-4" /> Upload Application
          </Button>
        </Link>
      </div>

      {/* ── Submitted applications ── */}
      {myApplications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <PenLine className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-2">No applications submitted yet</h3>
          <p className="text-sm text-gray-400 mb-5">Upload your first application to start earning.</p>
          <Link href="/writer/essays/new">
            <Button className="gap-2 bg-[#0851A0] text-white" style={{ background: "#0851A0" }}>
              <PenLine className="h-4 w-4" /> Upload Application
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {myApplications.map((app) => {
            const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
            const StatusIcon = status.icon;
            const supplementals = (() => { try { return JSON.parse(app.supplementals ?? "[]"); } catch { return []; } })();
            const essayCount = (app.submittedCommonApp ? 1 : 0) + (supplementals.length);
            return (
              <div key={app.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  {/* Uni logo */}
                  <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                    <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={40} height={40} className="object-contain p-0.5" unoptimized />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + status */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900">{app.title}</h3>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.style}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <p className="text-sm text-gray-500">
                      {app.university.name} · {app.admittedYear} · {essayCount} essay{essayCount !== 1 ? "s" : ""}
                      {app.submittedCommonApp && " (incl. Common App)"}
                    </p>

                    {/* Rejection note */}
                    {app.status === "rejected" && app.rejectionNote && (
                      <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                        Rejection reason: {app.rejectionNote}
                      </p>
                    )}

                    {/* Stats — only show when approved */}
                    {app.status === "approved" && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{app.views ?? 0} views</span>
                        <span className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />{app.purchases ?? 0} sales</span>
                      </div>
                    )}

                    <p className="text-xs text-gray-400 mt-1">Submitted {timeAgo(app.createdAt)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
