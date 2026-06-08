import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { universities, applicationDrafts, users } from "@/lib/db/schema";
import { asc, eq, and } from "drizzle-orm";
import { ApplicationUploadWizard } from "@/components/writer/ApplicationUploadWizard";
import { PdfImportPanel } from "@/components/writer/PdfImportPanel";
import { PageHead } from "@/components/writer/Manuscript";
import { PenLine, FileUp, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Upload Application" };

function parseProfileList(s?: string | null): { name: string; description: string }[] {
  try {
    const a = JSON.parse(s ?? "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export default async function NewEssayPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; mode?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const { draft: draftId, mode } = await searchParams;

  const [allUniversities, draft, writer] = await Promise.all([
    db.query.universities.findMany({ orderBy: [asc(universities.displayOrder)] }),
    draftId
      ? db.query.applicationDrafts.findFirst({
          where: and(eq(applicationDrafts.id, draftId), eq(applicationDrafts.writerId, session.user.id)),
        })
      : Promise.resolve(null),
    db.query.users.findFirst({ where: eq(users.id, session.user.id), columns: { activities: true, honors: true } }),
  ]);

  const profileActivities = parseProfileList(writer?.activities);
  const profileHonors = parseProfileList(writer?.honors);

  // ── Chooser: no draft and no mode chosen yet ──
  if (!draft && !mode) {
    return (
      <div className="anim-in mx-auto max-w-3xl px-11 pb-[70px] pt-10">
        <PageHead eyebrow="Publish" title="Add an application" sub="Two ways to get your application onto TrueDrafts." />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChooserCard
            href="/writer/essays/new?mode=import"
            icon={FileUp}
            title="Import from PDFs"
            recommended
            desc="Upload your admission proof + Common App PDFs — we read them and fill everything in for you to review."
          />
          <ChooserCard
            href="/writer/essays/new?mode=manual"
            icon={PenLine}
            title="Type it in"
            desc="Enter your essays, prompts, and details step by step."
          />
        </div>
      </div>
    );
  }

  // ── Import screen (PDF upload → extract → redirect to ?draft=<id>) ──
  if (mode === "import" && !draft) {
    return (
      <div className="anim-in mx-auto max-w-3xl px-11 pb-[70px] pt-10">
        <PageHead
          eyebrow="Publish"
          title="Import from PDFs"
          sub="Upload your admission proof and Common App PDF(s). We'll extract everything for you to review."
        />
        <PdfImportPanel />
      </div>
    );
  }

  // ── Wizard: manual entry or continuing a draft ──
  const initialData = draft?.data ? JSON.parse(draft.data) : {};
  // Seed the step-4 lists from the writer's profile when the start point doesn't
  // already carry them (manual flow, or an older draft saved before this step).
  if (initialData.activities === undefined) initialData.activities = profileActivities;
  if (initialData.honors === undefined) initialData.honors = profileHonors;
  const initialStep = draft?.currentStep ?? 1;

  return (
    <div className="anim-in mx-auto max-w-3xl px-11 pb-[70px] pt-10">
      <PageHead
        eyebrow="Publish"
        title={draft ? "Continue Application" : "Upload Application"}
        sub={
          draft
            ? `Continuing from where you left off · last saved ${new Date(draft.updatedAt!).toLocaleDateString()}`
            : "Share your essays from the application that got you in."
        }
      />
      <ApplicationUploadWizard
        universities={allUniversities}
        draftId={draft?.id}
        initialData={initialData}
        initialStep={initialStep}
      />
    </div>
  );
}

function ChooserCard({
  href,
  icon: Icon,
  title,
  desc,
  recommended,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  recommended?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-[14px] p-6 transition-shadow hover:shadow-md"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)" }}
    >
      {recommended && (
        <span
          className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: "var(--blue-wash)", color: "var(--td-blue)" }}
        >
          Recommended
        </span>
      )}
      <span
        className="flex h-11 w-11 items-center justify-center rounded-[10px]"
        style={{ background: "var(--blue-wash)", color: "var(--td-blue)" }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-[17px] font-bold" style={{ color: "var(--ink)" }}>{title}</h3>
      <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--td-blue)" }}>
        Continue <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
