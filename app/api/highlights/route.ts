import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { highlights } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { canAnnotate } from "@/lib/highlights/access";
import {
  MAX_QUOTE_LENGTH,
  isHighlightColor,
  isWellFormedAnchor,
  normalizeNote,
} from "@/lib/highlights/anchor";
import { and, asc, eq } from "drizzle-orm";

/** A reader can mark up this many passages per application. */
const MAX_PER_APPLICATION = 500;

/**
 * GET /api/highlights?applicationId=…
 *
 * The caller's own highlights on one application. Highlights are private:
 * there is no way to read someone else's, and the writer of an application
 * cannot see what buyers wrote on it.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applicationId = new URL(req.url).searchParams.get("applicationId");
  if (!applicationId) {
    return Response.json({ error: "applicationId required" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: highlights.id,
      essayIndex: highlights.essayIndex,
      paraIndex: highlights.paraIndex,
      startOffset: highlights.startOffset,
      endOffset: highlights.endOffset,
      quote: highlights.quote,
      note: highlights.note,
      color: highlights.color,
      createdAt: highlights.createdAt,
    })
    .from(highlights)
    .where(
      and(
        eq(highlights.userId, session.user.id),
        eq(highlights.applicationId, applicationId),
      ),
    )
    .orderBy(
      asc(highlights.essayIndex),
      asc(highlights.paraIndex),
      asc(highlights.startOffset),
    );

  return Response.json(rows, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST /api/highlights — mark a passage.
 *
 * The client sends the anchor and the text it selected. The quote is stored as
 * the client saw it, which is what the notes library renders and what lets us
 * spot an anchor that has drifted after a writer edits their application.
 */
export async function POST(req: Request) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
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

  const applicationId =
    typeof body.applicationId === "string" ? body.applicationId : "";
  if (!applicationId) {
    return Response.json({ error: "applicationId required" }, { status: 400 });
  }

  const verdict = await canAnnotate(session.user.id, applicationId);
  if (!verdict.ok) {
    return Response.json({ error: verdict.error }, { status: verdict.status });
  }

  const anchor = {
    essayIndex: Number(body.essayIndex),
    paraIndex: Number(body.paraIndex),
    startOffset: Number(body.startOffset),
    endOffset: Number(body.endOffset),
  };
  if (!isWellFormedAnchor(anchor)) {
    return Response.json({ error: "Invalid selection" }, { status: 422 });
  }

  const quote = typeof body.quote === "string" ? body.quote : "";
  if (!quote.trim()) {
    return Response.json({ error: "Nothing selected" }, { status: 422 });
  }
  if (quote.length > MAX_QUOTE_LENGTH) {
    return Response.json(
      { error: `Highlights are limited to ${MAX_QUOTE_LENGTH} characters.` },
      { status: 422 },
    );
  }

  const existing = await db
    .select({ id: highlights.id })
    .from(highlights)
    .where(
      and(
        eq(highlights.userId, session.user.id),
        eq(highlights.applicationId, applicationId),
      ),
    );
  if (existing.length >= MAX_PER_APPLICATION) {
    return Response.json(
      { error: `You've reached ${MAX_PER_APPLICATION} highlights on this one.` },
      { status: 422 },
    );
  }

  const inserted = await db
    .insert(highlights)
    .values({
      userId: session.user.id,
      applicationId,
      essayIndex: anchor.essayIndex,
      paraIndex: anchor.paraIndex,
      startOffset: anchor.startOffset,
      endOffset: anchor.endOffset,
      quote,
      note: normalizeNote(body.note),
      color: isHighlightColor(body.color) ? body.color : "yellow",
    })
    .returning({ id: highlights.id, createdAt: highlights.createdAt });

  return Response.json({ ok: true, ...inserted[0] }, { status: 201 });
}
