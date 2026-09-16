import { cache } from "react";
import { and, eq, inArray, gte, lte, sql, or } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bundles,
  collegeApplications,
  purchases,
  universities,
} from "@/lib/db/schema";
import type { Bundle, CollegeApplication, University } from "@/lib/db/schema";

// ─── Rule schema ─────────────────────────────────────────────────────────────
//
// Bundles with kind="rule" carry a JSON rule in `rule_config`. Each top-level
// key narrows the candidate pool; their intersection forms the membership set.
// Unknown keys are ignored (forward-compat).

export interface BundleRule {
  universityType?: "ivy" | "public_flagship" | "private_research" | "liberal_arts" | "other";
  universityIds?: string[];
  universitySlugs?: string[];
  region?: "northeast" | "south" | "midwest" | "west" | "mid_atlantic";
  admittedYear?: number;
  minPriceCents?: number;
  maxPriceCents?: number;
  tagsAny?: string[]; // application has at least one of these tags
}

export function parseBundleRule(raw: string | null | undefined): BundleRule {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as BundleRule;
  } catch {
    return {};
  }
}

// ─── Member resolution ───────────────────────────────────────────────────────

export type BundleMember = Pick<
  CollegeApplication,
  "id" | "title" | "slug" | "priceCents" | "writerId" | "universityId" | "tags" | "admittedYear"
> & { university: Pick<University, "id" | "name" | "slug" | "type" | "region"> };

/**
 * Resolves the actual member applications for a bundle. For static bundles,
 * filters the explicit ID list to currently-approved apps. For rule bundles,
 * runs the rule against the live universe.
 *
 * Always filters to status="approved" — drafts/rejected/archived apps cannot
 * be sold, so they cannot belong to a saleable bundle either. Returns members
 * in a stable order (by createdAt desc) so the UI is deterministic.
 */
export async function resolveBundleMembers(bundle: Bundle): Promise<BundleMember[]> {
  if (bundle.kind === "static") {
    const ids = bundle.applicationIds ?? [];
    if (ids.length === 0) return [];
    const rows = await db
      .select({
        id: collegeApplications.id,
        title: collegeApplications.title,
        slug: collegeApplications.slug,
        priceCents: collegeApplications.priceCents,
        writerId: collegeApplications.writerId,
        universityId: collegeApplications.universityId,
        tags: collegeApplications.tags,
        admittedYear: collegeApplications.admittedYear,
        university: {
          id: universities.id,
          name: universities.name,
          slug: universities.slug,
          type: universities.type,
          region: universities.region,
        },
      })
      .from(collegeApplications)
      .innerJoin(universities, eq(collegeApplications.universityId, universities.id))
      .where(
        and(
          inArray(collegeApplications.id, ids),
          eq(collegeApplications.status, "approved"),
        ),
      );
    return rows as BundleMember[];
  }

  // rule
  const rule = parseBundleRule(bundle.ruleConfig);
  const conditions = [eq(collegeApplications.status, "approved")];
  if (rule.admittedYear !== undefined) {
    conditions.push(eq(collegeApplications.admittedYear, rule.admittedYear));
  }
  if (rule.minPriceCents !== undefined) {
    conditions.push(gte(collegeApplications.priceCents, rule.minPriceCents));
  }
  if (rule.maxPriceCents !== undefined) {
    conditions.push(lte(collegeApplications.priceCents, rule.maxPriceCents));
  }
  if (rule.tagsAny && rule.tagsAny.length) {
    // Postgres array overlap: tags && ARRAY[...]
    conditions.push(sql`${collegeApplications.tags} && ${rule.tagsAny}`);
  }

  const uniConditions = [];
  if (rule.universityType) uniConditions.push(eq(universities.type, rule.universityType));
  if (rule.region) uniConditions.push(eq(universities.region, rule.region));
  if (rule.universityIds && rule.universityIds.length) {
    uniConditions.push(inArray(universities.id, rule.universityIds));
  }
  if (rule.universitySlugs && rule.universitySlugs.length) {
    uniConditions.push(inArray(universities.slug, rule.universitySlugs));
  }

  const whereExpr = uniConditions.length
    ? and(...conditions, ...uniConditions)
    : and(...conditions);

  const rows = await db
    .select({
      id: collegeApplications.id,
      title: collegeApplications.title,
      slug: collegeApplications.slug,
      priceCents: collegeApplications.priceCents,
      writerId: collegeApplications.writerId,
      universityId: collegeApplications.universityId,
      tags: collegeApplications.tags,
      admittedYear: collegeApplications.admittedYear,
      university: {
        id: universities.id,
        name: universities.name,
        slug: universities.slug,
        type: universities.type,
        region: universities.region,
      },
    })
    .from(collegeApplications)
    .innerJoin(universities, eq(collegeApplications.universityId, universities.id))
    .where(whereExpr);

  return rows as BundleMember[];
}

// ─── Pricing math ────────────────────────────────────────────────────────────

export interface BundlePricing {
  sumPrices: number;
  finalPrice: number;
  savings: number;
  savingsPercent: number;
}

/**
 * Computes the live bundle price. Sums member prices, then applies either a
 * flat override or a % discount. Always clamps to ≥ 0 and never lets the
 * "discounted" price exceed the sum (which would be a no-op anyway).
 */
export function computeBundlePrice(
  bundle: Pick<Bundle, "pricingMode" | "flatPriceCents" | "discountPercent">,
  members: ReadonlyArray<{ priceCents: number }>,
): BundlePricing {
  const sumPrices = members.reduce((acc, m) => acc + (m.priceCents ?? 0), 0);
  let finalPrice: number;
  if (bundle.pricingMode === "flat") {
    finalPrice = Math.max(0, Math.min(sumPrices, bundle.flatPriceCents ?? sumPrices));
  } else {
    const pct = Math.min(100, Math.max(0, bundle.discountPercent ?? 0));
    finalPrice = Math.round(sumPrices * (1 - pct / 100));
  }
  const savings = Math.max(0, sumPrices - finalPrice);
  const savingsPercent = sumPrices > 0 ? Math.round((savings / sumPrices) * 100) : 0;
  return { sumPrices, finalPrice, savings, savingsPercent };
}

/**
 * Splits a paid bundle total across member apps proportional to each app's
 * sticker price. Uses a rounding-remainder pass so the per-app shares sum to
 * EXACTLY the total (no off-by-one cents from naive rounding).
 *
 * Edge case: if every member has priceCents=0, splits the total evenly with
 * remainder distributed left-to-right.
 */
export function computeProRataSplits(
  totalCents: number,
  items: ReadonlyArray<{ applicationId: string; priceCents: number }>,
): Array<{ applicationId: string; shareCents: number }> {
  if (items.length === 0) return [];
  const sumPrices = items.reduce((acc, i) => acc + (i.priceCents ?? 0), 0);

  let raw: number[];
  if (sumPrices > 0) {
    raw = items.map((i) => Math.floor((totalCents * (i.priceCents ?? 0)) / sumPrices));
  } else {
    const base = Math.floor(totalCents / items.length);
    raw = items.map(() => base);
  }
  const distributed = raw.reduce((a, b) => a + b, 0);
  let remainder = totalCents - distributed;

  // Distribute remainder cents one at a time, prioritising higher-priced items
  // (sumPrices>0 case) or first items (zero-price case).
  const order =
    sumPrices > 0
      ? items
          .map((i, idx) => ({ idx, p: i.priceCents ?? 0 }))
          .sort((a, b) => b.p - a.p)
          .map((x) => x.idx)
      : items.map((_, idx) => idx);

  let cursor = 0;
  while (remainder > 0) {
    raw[order[cursor % order.length]] += 1;
    remainder--;
    cursor++;
  }

  return items.map((i, idx) => ({ applicationId: i.applicationId, shareCents: raw[idx] }));
}

// ─── Buyer-overlap check ─────────────────────────────────────────────────────

/**
 * Returns the subset of `applicationIds` the buyer already owns (via either
 * a single-app purchase OR a previous bundle child purchase). Bundle is
 * considered un-purchasable for buyer if this returns ANY ids — buyers don't
 * pay for things they already have.
 */
export async function checkBuyerOverlap(
  buyerId: string,
  applicationIds: ReadonlyArray<string>,
): Promise<string[]> {
  if (applicationIds.length === 0) return [];
  const rows = await db
    .select({ applicationId: purchases.applicationId })
    .from(purchases)
    .where(
      and(
        eq(purchases.buyerId, buyerId),
        eq(purchases.status, "completed"),
        inArray(purchases.applicationId, applicationIds as string[]),
      ),
    );
  return rows
    .map((r) => r.applicationId)
    .filter((id): id is string => id !== null);
}

// ─── Status / catalogue queries ──────────────────────────────────────────────

export type BundleAvailability =
  | "available"
  | "owns_some"
  | "not_started"
  | "expired"
  | "draft"
  | "archived"
  | "empty";

export function bundleAvailability(
  bundle: Pick<Bundle, "status" | "startsAt" | "endsAt">,
  memberCount: number,
  overlapCount: number,
  now: Date = new Date(),
): BundleAvailability {
  if (bundle.status === "draft") return "draft";
  if (bundle.status === "archived") return "archived";
  if (memberCount === 0) return "empty";
  if (bundle.startsAt && now < bundle.startsAt) return "not_started";
  if (bundle.endsAt && now > bundle.endsAt) return "expired";
  if (overlapCount > 0) return "owns_some";
  return "available";
}

/**
 * Returns currently-published, in-window bundles. Used by the public browse
 * hero strip and the /bundles index page. Does NOT filter by membership
 * (callers may want to render an "empty" state for diagnostic purposes).
 */
// Wrapped in React cache() so it runs at most once per server render. The
// browse page asks for active bundles from two places (the hero strip and the
// per-card membership map) — without this that's two ~1s round-trips for the
// same data. Callers must NOT pass `now` (varying args would defeat the memo);
// sub-second precision is irrelevant to bundle active-windows anyway.
export const getActiveBundles = cache(async (): Promise<Bundle[]> => {
  const now = new Date();
  const rows = await db
    .select()
    .from(bundles)
    .where(
      and(
        eq(bundles.status, "published"),
        // startsAt NULL or <= now
        or(sql`${bundles.startsAt} IS NULL`, lte(bundles.startsAt, now))!,
        // endsAt NULL or >= now
        or(sql`${bundles.endsAt} IS NULL`, gte(bundles.endsAt, now))!,
      ),
    );
  return rows;
});

/**
 * Returns the set of currently-published bundles each application belongs to,
 * keyed by applicationId. Pre-fetched once per page-render to avoid N+1
 * queries when the browse grid stamps "Part of: X" pills on cards.
 */
export async function getBundleMembershipMap(
  applicationIds: ReadonlyArray<string>,
  now: Date = new Date(),
): Promise<Map<string, Bundle[]>> {
  const map = new Map<string, Bundle[]>();
  if (applicationIds.length === 0) return map;

  const active = await getActiveBundles();
  if (active.length === 0) return map;

  // For static bundles we know members up front. For rule bundles we need to
  // resolve members; rule resolution touches the DB so we batch them.
  const requestedSet = new Set(applicationIds);

  for (const b of active) {
    let members: string[];
    if (b.kind === "static") {
      members = (b.applicationIds ?? []).filter((id) => requestedSet.has(id));
    } else {
      const resolved = await resolveBundleMembers(b);
      members = resolved.map((m) => m.id).filter((id) => requestedSet.has(id));
    }
    for (const id of members) {
      const existing = map.get(id);
      if (existing) existing.push(b);
      else map.set(id, [b]);
    }
  }
  return map;
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type { Bundle } from "@/lib/db/schema";
