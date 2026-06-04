import { auth } from "@/lib/auth";
import { db, writerUniversities } from "@/lib/db";
import { universities as universitiesTable, applicationDrafts, collegeApplications } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { universities } = body as { universities: { uniId: string; admittedYear: string }[] };

  if (!universities?.length) return Response.json({ ok: true });

  const writerId = session.user.id;
  const uniIds = universities.map((u) => u.uniId);

  // Record the writer's admits (drives their profile / verified admits).
  await db.delete(writerUniversities).where(eq(writerUniversities.writerId, writerId));
  await db.insert(writerUniversities).values(
    universities.map(({ uniId, admittedYear }) => ({
      writerId,
      universityId: uniId,
      admittedYear: admittedYear ? parseInt(admittedYear) : null,
      applicationProgress: 0,
      verifiedAdmit: false,
    }))
  );

  // Seed one in-progress draft application per selected university so the writer
  // lands on the dashboard with their applications already started. Idempotent:
  // skip any university that already has a draft or a submitted application
  // (so re-running onboarding never duplicates).
  const [uniRows, existingDrafts, existingApps] = await Promise.all([
    db
      .select({ id: universitiesTable.id, name: universitiesTable.name, slug: universitiesTable.slug })
      .from(universitiesTable)
      .where(inArray(universitiesTable.id, uniIds)),
    db
      .select({ universityId: applicationDrafts.universityId })
      .from(applicationDrafts)
      .where(eq(applicationDrafts.writerId, writerId)),
    db
      .select({ universityId: collegeApplications.universityId })
      .from(collegeApplications)
      .where(eq(collegeApplications.writerId, writerId)),
  ]);

  const uniById = new Map(uniRows.map((u) => [u.id, u]));
  const taken = new Set<string>([
    ...existingDrafts.map((d) => d.universityId).filter(Boolean) as string[],
    ...existingApps.map((a) => a.universityId).filter(Boolean) as string[],
  ]);

  const toSeed = universities.filter((u) => !taken.has(u.uniId) && uniById.has(u.uniId));
  if (toSeed.length > 0) {
    await db.insert(applicationDrafts).values(
      toSeed.map(({ uniId, admittedYear }) => {
        const uni = uniById.get(uniId)!;
        return {
          writerId,
          universityId: uniId,
          universityName: uni.name,
          universitySlug: uni.slug,
          currentStep: 1,
          // Pre-fill the upload wizard's step 1 with this university + year.
          data: JSON.stringify({ universityId: uniId, admittedYear: admittedYear || "" }),
        };
      })
    );
  }

  return Response.json({ ok: true });
}
