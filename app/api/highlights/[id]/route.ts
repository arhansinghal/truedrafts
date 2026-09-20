import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { highlights } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { isHighlightColor, normalizeNote } from "@/lib/highlights/anchor";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/highlights/[id] — change a highlight's note or colour.
 *
 * The anchor itself is immutable: re-selecting text creates a new highlight
 * rather than moving an old one, which keeps `quote` meaningful.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if ("note" in body) {
    patch.note = normalizeNote(body.note);
  }
  if ("color" in body) {
    if (!isHighlightColor(body.color)) {
      return Response.json({ error: "Unknown colour" }, { status: 422 });
    }
    patch.color = body.color;
  }

  if (Object.keys(patch).length === 1) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db
    .update(highlights)
    .set(patch)
    .where(eq(highlights.id, id))
    .returning({ id: highlights.id });

  if (updated.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

/**
 * DELETE /api/highlights/[id]
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await db
    .delete(highlights)
    .where(eq(highlights.id, id))
    .returning({ id: highlights.id });

  if (deleted.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
