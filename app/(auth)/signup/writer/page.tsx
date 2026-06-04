import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  universities,
  users,
  writerUniversities,
  collegeApplications,
  applicationDrafts,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/writer/OnboardingWizard";

export const metadata = { title: "Writer Onboarding" };

export default async function WriterSignupPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/signup");

  // Already-onboarded writers shouldn't be sent back through onboarding when they
  // tap a marketing "Start Earning" CTA. Any writer footprint — saved admits, a
  // published application, or a draft — means they've been here before, so send
  // them straight to their dashboard. (A brand-new writer has none of these and
  // still gets onboarding.)
  const [hasAdmit, hasApp, hasDraft] = await Promise.all([
    db.query.writerUniversities.findFirst({
      where: eq(writerUniversities.writerId, session.user.id),
      columns: { writerId: true },
    }),
    db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.writerId, session.user.id),
      columns: { id: true },
    }),
    db.query.applicationDrafts.findFirst({
      where: eq(applicationDrafts.writerId, session.user.id),
      columns: { id: true },
    }),
  ]);
  if (hasAdmit || hasApp || hasDraft) redirect("/writer");

  // User arrived here via Google OAuth (which defaults new accounts to "reader").
  // Upgrade them to "writer" automatically since they chose the writer signup path.
  if (session.user.role !== "writer") {
    await db.update(users).set({ role: "writer" }).where(eq(users.id, session.user.id));
  }

  const allUniversities = await db.query.universities.findMany({
    orderBy: [asc(universities.displayOrder)],
  });

  return (
    <div className="py-10 px-4 flex justify-center">
      <OnboardingWizard universities={allUniversities} initialName={session.user.name ?? ""} />
    </div>
  );
}
