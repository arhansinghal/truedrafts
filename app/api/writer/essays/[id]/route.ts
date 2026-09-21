import { auth } from "@/lib/auth";
import { db, essays } from "@/lib/db";
import { essayRevisions } from "@/lib/db/schema";
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

  // Snapshot the body so the writer can diff and roll back later. Only worth
  // a row when the text actually changed — metadata-only edits (price, title)
  // would otherwise fill the history with identical entries.
  if (fullContent) {
    await db.insert(essayRevisions).values({
      essayId: id,
      editorId: session.user.id,
      content: fullContent,
      wordCount: fullContent.split(/\s+/).length,
      note: typeof body.revisionNote === "string" ? body.revisionNote.slice(0, 500) : null,
    });
  }

  return Response.json({ ok: true });
}
