import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationDrafts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/writer/drafts — list all drafts for this writer
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const drafts = await db.query.applicationDrafts.findMany({
    where: eq(applicationDrafts.writerId, session.user.id),
    orderBy: [desc(applicationDrafts.updatedAt)],
  });

  return Response.json(drafts);
}

// POST /api/writer/drafts — create a new draft
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { universityId, universityName, universitySlug, currentStep, data } = body;

  const [draft] = await db
    .insert(applicationDrafts)
    .values({
      writerId: session.user.id,
      universityId: universityId || null,
      universityName: universityName || null,
      universitySlug: universitySlug || null,
      currentStep: currentStep ?? 1,
      data: JSON.stringify(data ?? {}),
    })
    .returning();

  return Response.json(draft, { status: 201 });
}
