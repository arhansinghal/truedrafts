/**
 * Database access for the writer analytics dashboard.
 *
 * One entry point — `loadWriterAnalytics` — which does four round-trips and
 * folds everything in memory. The alternative (a pile of GROUP BY queries, one
 * per metric) meant six or seven trips to a database that sits in us-east-1;
 * from India that is a second each. Pulling the raw rows once and aggregating
 * in JS is dramatically faster at the volumes a single writer produces.
 *
 * Column selection is explicit everywhere. The listing tables carry heavy
 * columns (full essay text, the 1024-dim `insightBriefEmbedding` vector) that
 * must never be dragged into a list query — see the Browse page perf notes.
 */

import { db } from "@/lib/db";
import {
  collegeApplications,
  essays,
  listingEvents,
  purchases,
} from "@/lib/db/schema";
import { and, eq, gte, inArray, lte, or } from "drizzle-orm";

import {
  buildFunnel,
  buildListingRows,
  buildTrend,
  countsByListing,
  delta,
  totalOf,
  type EventRow,
  type ListingMeta,
  type SaleRow,
} from "./metrics";
import type { AnalyticsPayload, RangeKey, Window } from "./types";
import { enumerateBuckets, previousWindow, windowFor } from "./window";

/** Rows fetched once and split across the current / previous windows. */
type Split<T> = { current: T[]; previous: T[] };

function splitByWindow<T>(
  rows: T[],
  at: (row: T) => Date,
  current: Window,
): Split<T> {
  const out: Split<T> = { current: [], previous: [] };
  for (const row of rows) {
    const t = at(row).getTime();
    if (t >= current.start.getTime() && t <= current.end.getTime()) {
      out.current.push(row);
    } else {
      out.previous.push(row);
    }
  }
  return out;
}

/**
 * Every listing this writer owns, as thin metadata rows.
 *
 * Both product generations are included: `college_applications` (the current
 * listing type) and the legacy standalone `essays`. A writer who predates
 * applications still deserves a dashboard.
 */
async function loadListings(writerId: string): Promise<ListingMeta[]> {
  const [apps, legacyEssays] = await Promise.all([
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, writerId),
      columns: {
        id: true,
        title: true,
        status: true,
        views: true,
        purchases: true,
      },
      with: { university: { columns: { name: true } } },
    }),
    db.query.essays.findMany({
      where: eq(essays.writerId, writerId),
      columns: {
        id: true,
        title: true,
        status: true,
        views: true,
        purchases: true,
      },
      with: { university: { columns: { name: true } } },
    }),
  ]);

  const toMeta = (row: {
    id: string;
    title: string;
    status: string;
    views: number;
    purchases: number;
    university?: { name: string } | null;
  }): ListingMeta => ({
    id: row.id,
    title: row.title,
    universityName: row.university?.name ?? "Unknown",
    status: row.status,
    lifetimeViews: row.views ?? 0,
    lifetimePurchases: row.purchases ?? 0,
  });

  return [...apps.map(toMeta), ...legacyEssays.map(toMeta)];
}

/** Timestamped views / preview opens across both windows. */
async function loadEvents(
  writerId: string,
  from: Date,
  to: Date,
): Promise<EventRow[]> {
  const rows = await db
    .select({
      essayId: listingEvents.essayId,
      applicationId: listingEvents.applicationId,
      kind: listingEvents.kind,
      occurredAt: listingEvents.occurredAt,
    })
    .from(listingEvents)
    .where(
      and(
        eq(listingEvents.writerId, writerId),
        gte(listingEvents.occurredAt, from),
        lte(listingEvents.occurredAt, to),
      ),
    );

  return rows.map((r) => ({
    essayId: r.essayId,
    applicationId: r.applicationId,
    kind: r.kind,
    occurredAt: r.occurredAt,
  }));
}

/**
 * Completed sales of this writer's listings across both windows.
 *
 * `purchases` has no writer column — it points at the listing — so the ids are
 * resolved first and matched with `inArray`. Bundle child rows are included:
 * they carry a real `writerPayoutCents` and are genuine revenue for the writer.
 */
async function loadSales(
  listingIds: string[],
  from: Date,
  to: Date,
): Promise<SaleRow[]> {
  if (listingIds.length === 0) return [];

  const rows = await db
    .select({
      essayId: purchases.essayId,
      applicationId: purchases.applicationId,
      writerPayoutCents: purchases.writerPayoutCents,
      purchasedAt: purchases.purchasedAt,
    })
    .from(purchases)
    .where(
      and(
        eq(purchases.status, "completed"),
        gte(purchases.purchasedAt, from),
        lte(purchases.purchasedAt, to),
        or(
          inArray(purchases.essayId, listingIds),
          inArray(purchases.applicationId, listingIds),
        ),
      ),
    );

  return rows.map((r) => ({
    essayId: r.essayId,
    applicationId: r.applicationId,
    writerPayoutCents: r.writerPayoutCents ?? 0,
    // `purchased_at` is nullable in the schema for historical rows; anything
    // that came back from a range filter has a value, but be defensive.
    purchasedAt: r.purchasedAt ?? from,
  }));
}

/**
 * Assemble the full dashboard payload for one writer.
 *
 * `now` is injectable so tests can pin the window without freezing the clock.
 */
export async function loadWriterAnalytics(
  writerId: string,
  range: RangeKey,
  now: Date = new Date(),
): Promise<AnalyticsPayload> {
  const w = windowFor(range, now);
  const prev = previousWindow(w);

  const listings = await loadListings(writerId);
  const listingIds = listings.map((l) => l.id);

  // One fetch spanning both windows, split in memory. Two queries would double
  // the latency for no benefit — the row counts here are small.
  const [events, sales] = await Promise.all([
    loadEvents(writerId, prev.start, w.end),
    loadSales(listingIds, prev.start, w.end),
  ]);

  const splitEvents = splitByWindow(events, (e) => e.occurredAt, w);
  const splitSales = splitByWindow(sales, (s) => s.purchasedAt, w);

  const trend = buildTrend(w, splitEvents.current, splitSales.current);
  const previousTrend = buildTrend(prev, splitEvents.previous, splitSales.previous);

  const funnel = buildFunnel(trend);
  const listingRows = buildListingRows(
    listings,
    countsByListing(splitEvents.current, splitSales.current),
  );

  return {
    range,
    granularity: w.granularity,
    startsAt: w.start.toISOString(),
    endsAt: w.end.toISOString(),
    trend,
    funnel,
    listings: listingRows,
    revenue: delta(
      totalOf(trend, "revenueCents"),
      totalOf(previousTrend, "revenueCents"),
    ),
    sales: delta(
      totalOf(trend, "purchases"),
      totalOf(previousTrend, "purchases"),
    ),
    traffic: delta(totalOf(trend, "views"), totalOf(previousTrend, "views")),
  };
}

/**
 * Record a view / preview-open against a listing.
 *
 * Best effort by design: the caller is a fire-and-forget beacon from a reader's
 * browser, and a analytics write must never turn into a failed page view. Any
 * error is swallowed after logging.
 */
export async function recordListingEvent(input: {
  writerId: string;
  essayId?: string | null;
  applicationId?: string | null;
  kind: "view" | "preview_open";
  occurredAt?: Date;
}): Promise<void> {
  try {
    await db.insert(listingEvents).values({
      writerId: input.writerId,
      essayId: input.essayId ?? null,
      applicationId: input.applicationId ?? null,
      kind: input.kind,
      occurredAt: input.occurredAt ?? new Date(),
    });
  } catch (err) {
    console.error("[analytics] failed to record listing event", err);
  }
}

/** Bucket count for the selected range — used for the "N days" caption. */
export function bucketCountFor(range: RangeKey, now: Date = new Date()): number {
  return enumerateBuckets(windowFor(range, now)).length;
}
