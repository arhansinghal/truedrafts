import { auth } from "@/lib/auth";
import { db, essays } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateSlug, computePreview } from "@/lib/utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const essay = await db.query.essays.findFirst({
    where: and(eq(essays.id, id), eq(essays.writerId, session.user.id)),
  });
  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { title, universityId, essayType, fullContent, priceCents, admittedYear } = body;

  const updates: Record<string, unknown> = {};
  if (title) updates.title = title;
  if (universityId) updates.universityId = universityId;
  if (essayType) updates.essayType = essayType;
  if (priceCents) updates.priceCents = priceCents;
  if (admittedYear !== undefined) updates.admittedYear = admittedYear;
  if (fullContent) {
    updates.fullContent = fullContent;
    updates.previewContent = computePreview(fullContent, 0.25);
    updates.wordCount = fullContent.split(/\s+/).length;
    updates.status = "pending"; // re-submit for review
  }

  await db.update(essays).set(updates).where(eq(essays.id, id));
  return Response.json({ ok: true });
}
