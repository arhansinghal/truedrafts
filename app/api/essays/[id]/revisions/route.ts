import { auth } from "@/lib/auth";
import { db, essays } from "@/lib/db";
import { essayRevisions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { computePreview } from "@/lib/utils";

/** Revision history for an essay, newest first. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db.query.essayRevisions.findMany({
    where: eq(essayRevisions.essayId, id),
    orderBy: [desc(essayRevisions.createdAt)],
    limit: 50,
  });

  return Response.json(rows);
}

/** Roll the essay back to one of its stored revisions. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const revisionId = typeof body.revisionId === "string" ? body.revisionId : null;
  if (!revisionId) {
    return Response.json({ error: "revisionId is required" }, { status: 400 });
  }

  const revision = await db.query.essayRevisions.findFirst({
    where: eq(essayRevisions.id, revisionId),
  });
  if (!revision || revision.essayId !== id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(essays)
    .set({
      fullContent: revision.content,
      previewContent: computePreview(revision.content, 0.25),
      wordCount: revision.wordCount,
      status: "pending", // a rollback is a content change; re-review it
    })
    .where(eq(essays.id, id));

  return Response.json({ ok: true, restoredFrom: revision.createdAt });
}
