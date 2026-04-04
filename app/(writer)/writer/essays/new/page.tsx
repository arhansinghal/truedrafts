import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { universities, applicationDrafts } from "@/lib/db/schema";
import { asc, eq, and } from "drizzle-orm";
import { ApplicationUploadWizard } from "@/components/writer/ApplicationUploadWizard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Upload Application" };

export default async function NewEssayPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const { draft: draftId } = await searchParams;

  const [allUniversities, draft] = await Promise.all([
    db.query.universities.findMany({ orderBy: [asc(universities.displayOrder)] }),
    draftId
      ? db.query.applicationDrafts.findFirst({
          where: and(
            eq(applicationDrafts.id, draftId),
            eq(applicationDrafts.writerId, session.user.id),
          ),
        })
      : Promise.resolve(null),
  ]);

  const initialData = draft?.data ? JSON.parse(draft.data) : undefined;
  const initialStep = draft?.currentStep ?? 1;

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {draft ? "Continue Application" : "Upload Application"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {draft
            ? `Continuing from where you left off · last saved ${new Date(draft.updatedAt!).toLocaleDateString()}`
            : "Share your essays from the application that got you in."}
        </p>
      </div>
      <ApplicationUploadWizard
        universities={allUniversities}
        draftId={draft?.id}
        initialData={initialData}
        initialStep={initialStep}
      />
    </div>
  );
}
