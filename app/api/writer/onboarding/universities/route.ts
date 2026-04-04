import { auth } from "@/lib/auth";
import { db, writerUniversities } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { universities } = body as { universities: { uniId: string; admittedYear: string }[] };

  if (!universities?.length) return Response.json({ ok: true });

  // Delete existing and re-insert
  await db.delete(writerUniversities).where(eq(writerUniversities.writerId, session.user.id));

  await db.insert(writerUniversities).values(
    universities.map(({ uniId, admittedYear }) => ({
      writerId: session.user.id,
      universityId: uniId,
      admittedYear: admittedYear ? parseInt(admittedYear) : null,
      applicationProgress: 0,
      verifiedAdmit: false,
    }))
  );

  return Response.json({ ok: true });
}
