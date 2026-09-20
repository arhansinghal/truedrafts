import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import {
  describeFilters,
  isEmptyFilters,
  normalizeFilters,
  parseFilters,
  serializeFilters,
} from "@/lib/saved-search/filters";
import { countForUser } from "@/lib/saved-search/digest";
import { desc, eq } from "drizzle-orm";

/** A reader can pin this many searches. Enough for a real shortlist, not a scraper. */
const MAX_PER_USER = 20;

/**
 * GET /api/saved-searches — the caller's own saved searches.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, session.user.id))
    .orderBy(desc(savedSearches.createdAt));

  return Response.json(
    rows.map((row) => {
      const filters = parseFilters(row.filters);
      return {
        id: row.id,
        name: row.name,
        cadence: row.cadence,
        filters,
        description: describeFilters(filters),
        matchesSent: row.matchesSent,
        lastNotifiedAt: row.lastNotifiedAt,
        createdAt: row.createdAt,
      };
    }),
  );
}

/**
 * POST /api/saved-searches — pin the current Browse filters.
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

  const filters = normalizeFilters(body.filters);
  if (isEmptyFilters(filters)) {
    return Response.json(
      {
        error: "empty_filters",
        message: "Pick at least one filter before saving this search.",
      },
      { status: 422 },
    );
  }

  const existing = await countForUser(session.user.id);
  if (existing >= MAX_PER_USER) {
    return Response.json(
      {
        error: "limit_reached",
        message: `You can save up to ${MAX_PER_USER} searches. Delete one to make room.`,
      },
      { status: 422 },
    );
  }

  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  const name = (rawName || describeFilters(filters)).slice(0, 120);

  const cadence =
    body.cadence === "off" || body.cadence === "daily" || body.cadence === "weekly"
      ? body.cadence
      : "weekly";

  const inserted = await db
    .insert(savedSearches)
    .values({
      userId: session.user.id,
      name,
      filters: serializeFilters(filters),
      cadence,
      // A brand-new search starts its watermark now, so the first digest covers
      // what shows up *after* saving rather than replaying the back catalogue.
      lastNotifiedAt: new Date(),
    })
    .returning({ id: savedSearches.id });

  return Response.json(
    { ok: true, id: inserted[0].id, name, cadence },
    { status: 201 },
  );
}
