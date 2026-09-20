/**
 * Data access for the university insights page.
 *
 * Column selection is explicit and deliberately narrow. `college_applications`
 * carries the full essay bodies and a 1024-dimension `insightBriefEmbedding`
 * vector; pulling those across the Neon socket is what made the Browse page
 * take eight seconds. This page aggregates over every application a school has,
 * so it is exactly the query that must not do that.
 */

import { db } from "@/lib/db";
import { collegeApplications, universities } from "@/lib/db/schema";
import { and, eq, ne, or, sql } from "drizzle-orm";

import { buildInsights, type InsightRow, type UniversityInsights } from "./stats";

export type UniversitySummary = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  region: string | null;
  type: string | null;
};

/** Look a school up by its URL slug. */
export async function findUniversityBySlug(
  slug: string,
): Promise<UniversitySummary | null> {
  const row = await db.query.universities.findFirst({
    where: eq(universities.slug, slug),
    columns: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      region: true,
      type: true,
    },
  });
  return row ?? null;
}

/**
 * Every live application for a school, as thin aggregation rows.
 *
 * Only `approved` listings count: pending and rejected ones are not public, and
 * including them would make the page describe a catalogue nobody can browse.
 */
export async function loadInsightRows(
  universityId: string,
): Promise<InsightRow[]> {
  const rows = await db
    .select({
      id: collegeApplications.id,
      priceCents: collegeApplications.priceCents,
      admittedYear: collegeApplications.admittedYear,
      tags: collegeApplications.tags,
      major: collegeApplications.major,
      submittedCommonApp: collegeApplications.submittedCommonApp,
      numSupplementals: collegeApplications.numSupplementals,
      purchases: collegeApplications.purchases,
      views: collegeApplications.views,
    })
    .from(collegeApplications)
    .where(
      and(
        eq(collegeApplications.universityId, universityId),
        eq(collegeApplications.status, "approved"),
      ),
    );

  return rows;
}

export type RelatedUniversity = UniversitySummary & {
  applicationCount: number;
};

/**
 * Other schools worth a look from here: same classification first (ivy,
 * liberal arts, public flagship…), then same region.
 *
 * Schools with nothing published are left out — sending a reader to an empty
 * page is worse than showing them one fewer option.
 */
export async function relatedUniversities(
  university: UniversitySummary,
  limit = 6,
): Promise<RelatedUniversity[]> {
  const affinities = [
    university.type ? eq(universities.type, university.type) : null,
    university.region ? eq(universities.region, university.region) : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  if (affinities.length === 0) return [];

  const rows = await db
    .select({
      id: universities.id,
      name: universities.name,
      slug: universities.slug,
      city: universities.city,
      state: universities.state,
      region: universities.region,
      type: universities.type,
      applicationCount: sql<number>`count(${collegeApplications.id})::int`,
    })
    .from(universities)
    .leftJoin(
      collegeApplications,
      and(
        eq(collegeApplications.universityId, universities.id),
        eq(collegeApplications.status, "approved"),
      ),
    )
    .where(
      and(
        ne(universities.id, university.id),
        affinities.length === 1 ? affinities[0] : or(...affinities),
      ),
    )
    .groupBy(
      universities.id,
      universities.name,
      universities.slug,
      universities.city,
      universities.state,
      universities.region,
      universities.type,
    )
    .having(sql`count(${collegeApplications.id}) > 0`)
    .orderBy(sql`count(${collegeApplications.id}) DESC`, universities.name)
    .limit(limit);

  return rows;
}

export type InsightsPayload = {
  university: UniversitySummary;
  insights: UniversityInsights;
  related: RelatedUniversity[];
};

/** Everything the page needs, in two round-trips rather than four. */
export async function loadUniversityInsights(
  slug: string,
): Promise<InsightsPayload | null> {
  const university = await findUniversityBySlug(slug);
  if (!university) return null;

  const [rows, related] = await Promise.all([
    loadInsightRows(university.id),
    relatedUniversities(university),
  ]);

  return {
    university,
    insights: buildInsights(rows),
    related,
  };
}
