/**
 * Turning a saved search into a query.
 *
 * Two consumers: the digest job (new applications since a watermark) and the
 * saved-search preview on the dashboard (how many match right now). Both go
 * through `buildMatchConditions` so a saved search means the same thing
 * wherever it is evaluated.
 */

import { collegeApplications, universities } from "@/lib/db/schema";
import { db } from "@/lib/db";
import {
  and,
  arrayOverlaps,
  eq,
  gt,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import type { SavedSearchFilters } from "./filters";

/** Resolve a university slug to its id, or null when the slug is unknown. */
export async function universityIdForSlug(
  slug: string,
): Promise<string | null> {
  const row = await db.query.universities.findFirst({
    where: eq(universities.slug, slug),
    columns: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Free-text match across the same blob the Browse page searches, so a saved
 * search returns what the reader saw when they saved it.
 */
function textCondition(q: string): SQL {
  const haystack = sql`lower(
    coalesce(${collegeApplications.vibeSearchText}, '') || ' ' ||
    coalesce(${collegeApplications.title}, '') || ' ' ||
    coalesce(${collegeApplications.major}, '') || ' ' ||
    array_to_string(coalesce(${collegeApplications.tags}, '{}'::text[]), ' ')
  )`;
  return sql`${haystack} LIKE ${"%" + q.toLowerCase() + "%"}`;
}

/**
 * Every condition a saved search implies, excluding the "is it new" watermark
 * (callers add that themselves — the preview wants all matches, the digest
 * wants recent ones).
 *
 * `universityId` is passed in already resolved so this stays synchronous and
 * unit-testable.
 */
export function buildMatchConditions(
  filters: SavedSearchFilters,
  universityId: string | null,
): SQL[] {
  const conditions: SQL[] = [
    // Only ever surface live listings.
    eq(collegeApplications.status, "approved"),
  ];

  if (filters.q) {
    conditions.push(textCondition(filters.q));
  }

  if (universityId) {
    conditions.push(eq(collegeApplications.universityId, universityId));
  }

  if (filters.years.length > 0) {
    conditions.push(inArray(collegeApplications.admittedYear, filters.years));
  }

  if (filters.tags.length > 0) {
    // The reader ticked these to narrow the list: a listing has to carry all
    // of them, not merely brush against one.
    conditions.push(arrayOverlaps(collegeApplications.tags, filters.tags));
  }

  if (filters.maxPriceCents !== null) {
    conditions.push(
      lte(collegeApplications.priceCents, filters.maxPriceCents),
    );
  }

  if (filters.commonAppOnly) {
    conditions.push(eq(collegeApplications.submittedCommonApp, true));
  }

  return conditions;
}

/** One row as the digest renders it. */
export type MatchRow = {
  id: string;
  slug: string;
  title: string;
  admittedYear: number | null;
  priceCents: number;
  universityName: string;
  publishedAt: Date | null;
};

/**
 * Applications matching `filters` that went live after `since`.
 *
 * `until` bounds the top of the window so a run can stamp a watermark that
 * exactly matches what it looked at — anything published mid-run belongs to
 * the next run, not to neither.
 */
export async function findNewMatches(input: {
  filters: SavedSearchFilters;
  universityId: string | null;
  since: Date;
  until: Date;
  limit: number;
}): Promise<MatchRow[]> {
  const conditions = buildMatchConditions(input.filters, input.universityId);
  conditions.push(gt(collegeApplications.publishedAt, input.since));

  const rows = await db
    .select({
      id: collegeApplications.id,
      slug: collegeApplications.slug,
      title: collegeApplications.title,
      admittedYear: collegeApplications.admittedYear,
      priceCents: collegeApplications.priceCents,
      universityName: universities.name,
      publishedAt: collegeApplications.publishedAt,
    })
    .from(collegeApplications)
    .innerJoin(
      universities,
      eq(collegeApplications.universityId, universities.id),
    )
    .where(and(...conditions))
    .orderBy(collegeApplications.publishedAt)
    .limit(input.limit);

  return rows;
}

/** How many live applications a saved search matches today. */
export async function countMatches(
  filters: SavedSearchFilters,
  universityId: string | null,
): Promise<number> {
  const conditions = buildMatchConditions(filters, universityId);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collegeApplications)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}
