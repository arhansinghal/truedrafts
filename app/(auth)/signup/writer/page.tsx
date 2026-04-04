import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { universities, users } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { OnboardingWizard } from "@/components/writer/OnboardingWizard";

export const metadata = { title: "Writer Onboarding" };

export default async function WriterSignupPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/signup");

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
      <OnboardingWizard universities={allUniversities} />
    </div>
  );
}
