import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { applicationDrafts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { bodyExceedsLimit, MAX_BODY_BYTES } from "@/lib/request-limits";

// PATCH /api/writer/drafts/[id] — update an existing draft
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (bodyExceedsLimit(req)) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  const { id } = await params;
  const body = await req.json();
  const { universityId, universityName, universitySlug, currentStep, data } = body;

  const serializedData = data !== undefined ? JSON.stringify(data) : undefined;
  if (serializedData !== undefined && serializedData.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Draft is too large" }, { status: 413 });
  }

  const [updated] = await db
    .update(applicationDrafts)
    .set({
      universityId: universityId ?? undefined,
      universityName: universityName ?? undefined,
      universitySlug: universitySlug ?? undefined,
      currentStep: currentStep ?? undefined,
      data: serializedData,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(applicationDrafts.id, id),
        eq(applicationDrafts.writerId, session.user.id),
      )
    )
    .returning();

  if (!updated) return Response.json({ error: "Draft not found" }, { status: 404 });
  return Response.json(updated);
}

// DELETE /api/writer/drafts/[id] — delete a draft
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(applicationDrafts)
    .where(
      and(
        eq(applicationDrafts.id, id),
        eq(applicationDrafts.writerId, session.user.id),
      )
    );

  return new Response(null, { status: 204 });
}
