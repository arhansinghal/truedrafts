import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import {
  normalizeFilters,
  isEmptyFilters,
  serializeFilters,
} from "@/lib/saved-search/filters";
import { and, eq } from "drizzle-orm";

/**
 * PATCH /api/saved-searches/[id] — rename, re-filter, or change cadence.
 *
 * Every statement is scoped by `userId` as well as `id`, so knowing another
 * reader's saved-search id gets you nothing.
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

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 120);
    if (!name) {
      return Response.json(
        { error: "invalid", message: "Give it a name." },
        { status: 422 },
      );
    }
    patch.name = name;
  }

  if (
    body.cadence === "off" ||
    body.cadence === "daily" ||
    body.cadence === "weekly"
  ) {
    patch.cadence = body.cadence;
  }

  if (body.filters !== undefined) {
    const filters = normalizeFilters(body.filters);
    if (isEmptyFilters(filters)) {
      return Response.json(
        {
          error: "empty_filters",
          message: "A saved search needs at least one filter.",
        },
        { status: 422 },
      );
    }
    patch.filters = serializeFilters(filters);
  }

  const updated = await db
    .update(savedSearches)
    .set(patch)
    .where(
      and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.id)),
    )
    .returning({ id: savedSearches.id });

  if (updated.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}

/**
 * DELETE /api/saved-searches/[id]
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
    .delete(savedSearches)
    .where(
      and(eq(savedSearches.id, id), eq(savedSearches.userId, session.user.id)),
    )
    .returning({ id: savedSearches.id });

  if (deleted.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ ok: true });
}
