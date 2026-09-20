/**
 * Pure aggregation for the writer analytics dashboard.
 *
 * Nothing in here touches the database. The query layer (`./query.ts`) pulls
 * rows, and these functions fold them into the shapes the UI renders — which
 * keeps the interesting arithmetic unit-testable without a Neon connection.
 *
 * Money is INR paise throughout, as everywhere else in the codebase. Ratios are
 * whole-number percentages (0–100) because every display site rounds anyway.
 */

import type {
  Delta,
  Funnel,
  Granularity,
  ListingRow,
  TrendPoint,
  Window,
} from "./types";
import { bucketKey, enumerateBuckets } from "./window";

/** A single timestamped view / preview-open, as stored in `listing_events`. */
export type EventRow = {
  essayId: string | null;
  applicationId: string | null;
  kind: "view" | "preview_open";
  occurredAt: Date;
};

/** A completed sale inside the window. */
export type SaleRow = {
  essayId: string | null;
  applicationId: string | null;
  writerPayoutCents: number;
  purchasedAt: Date;
};

/** Listing metadata joined in for the performance table. */
export type ListingMeta = {
  id: string;
  title: string;
  universityName: string;
  status: string;
  /** Lifetime counter straight off the listing row. */
  lifetimeViews: number;
  /** Lifetime counter straight off the listing row. */
  lifetimePurchases: number;
};

/** Counts for one listing, scoped to the selected window. */
export type WindowedCounts = {
  views: number;
  previewOpens: number;
  purchases: number;
  revenueCents: number;
};

function emptyCounts(): WindowedCounts {
  return { views: 0, previewOpens: 0, purchases: 0, revenueCents: 0 };
}

/**
 * Whole-number percentage of `numerator` over `denominator`.
 *
 * An empty denominator is reported as 0 rather than NaN — a writer with no
 * traffic yet should see "0%", not a broken cell.
 */
export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

/**
 * A headline figure plus its change against the preceding window.
 *
 * When the previous window is empty there is no meaningful percentage to show
 * (everything is an infinite increase), so `changePct` is null and the UI falls
 * back to a plain "new" badge.
 */
export function delta(current: number, previous: number): Delta {
  if (previous === 0) {
    return { current, previous, changePct: null };
  }
  const changePct = Math.round(((current - previous) / current) * 100);
  return {
    current,
    previous,
    changePct: Number.isFinite(changePct) ? changePct : null,
  };
}

/** Which listing an event or sale belongs to — essays and applications share a table. */
function listingIdOf(row: {
  essayId: string | null;
  applicationId: string | null;
}): string | null {
  return row.essayId ?? row.applicationId ?? null;
}

/**
 * Fold raw events and sales onto the window's bucket scaffold.
 *
 * The scaffold comes first so that quiet days render as zeroes instead of
 * disappearing and squashing the x-axis.
 */
export function buildTrend(
  w: Window,
  events: EventRow[],
  sales: SaleRow[],
): TrendPoint[] {
  const keys = enumerateBuckets(w);
  const byKey = new Map<string, TrendPoint>();
  for (const key of keys) {
    byKey.set(key, {
      key,
      views: 0,
      previewOpens: 0,
      purchases: 0,
      revenueCents: 0,
    });
  }

  for (const e of events) {
    const point = byKey.get(bucketKey(e.occurredAt, w.granularity));
    if (!point) continue; // outside the window — ignore rather than widen the axis
    if (e.kind === "view") point.views += 1;
    else point.previewOpens += 1;
  }

  for (const s of sales) {
    const point = byKey.get(bucketKey(s.purchasedAt, w.granularity));
    if (!point) continue;
    point.purchases += 1;
    point.revenueCents += s.writerPayoutCents;
  }

  return keys.map((k) => byKey.get(k)!);
}

/** Sum one field across the trend. */
export function totalOf(
  trend: TrendPoint[],
  field: "views" | "previewOpens" | "purchases" | "revenueCents",
): number {
  return trend.reduce((sum, point) => sum + point[field], 0);
}

/**
 * The view → preview → purchase funnel for the selected window.
 *
 * Every stage is derived from the same trend array, so the three stages are
 * guaranteed to describe the same span of time.
 */
export function buildFunnel(trend: TrendPoint[]): Funnel {
  const views = totalOf(trend, "views");
  const previewOpens = totalOf(trend, "previewOpens");
  const purchases = totalOf(trend, "purchases");
  return {
    views,
    previewOpens,
    purchases,
    viewToPreviewPct: pct(previewOpens, views),
    previewToPurchasePct: pct(purchases, previewOpens),
    overallConversionPct: pct(purchases, views),
  };
}

/**
 * Group events and sales by listing so the performance table can show a row per
 * application without a second round-trip to the database.
 */
export function countsByListing(
  events: EventRow[],
  sales: SaleRow[],
): Map<string, WindowedCounts> {
  const out = new Map<string, WindowedCounts>();

  const bucketFor = (id: string): WindowedCounts => {
    let existing = out.get(id);
    if (!existing) {
      existing = emptyCounts();
      out.set(id, existing);
    }
    return existing;
  };

  for (const e of events) {
    const id = listingIdOf(e);
    if (!id) continue;
    const counts = bucketFor(id);
    if (e.kind === "view") counts.views += 1;
    else counts.previewOpens += 1;
  }

  for (const s of sales) {
    const id = listingIdOf(s);
    if (!id) continue;
    const counts = bucketFor(id);
    counts.purchases += 1;
    counts.revenueCents += s.writerPayoutCents;
  }

  return out;
}

/**
 * Build the per-listing performance rows, sorted by the revenue they brought in
 * during the window (ties broken by title so the order is stable across
 * reloads).
 *
 * `conversionPct` answers "of the people who landed on this listing in the
 * selected range, how many of them bought it".
 */
export function buildListingRows(
  listings: ListingMeta[],
  windowed: Map<string, WindowedCounts>,
): ListingRow[] {
  const rows: ListingRow[] = listings.map((listing) => {
    const counts = windowed.get(listing.id) ?? emptyCounts();
    return {
      id: listing.id,
      title: listing.title,
      universityName: listing.universityName,
      status: listing.status,
      views: counts.views,
      previewOpens: counts.previewOpens,
      purchases: counts.purchases,
      revenueCents: counts.revenueCents,
      conversionPct: pct(listing.lifetimePurchases, counts.views),
    };
  });

  rows.sort((a, b) => {
    if (b.revenueCents !== a.revenueCents) {
      return b.revenueCents - a.revenueCents;
    }
    return a.title.localeCompare(b.title);
  });

  return rows;
}

/**
 * Best performing bucket, used for the "peak day" callout. Returns null for an
 * entirely empty window so the callout can be hidden rather than showing a
 * meaningless zero.
 */
export function peakBucket(
  trend: TrendPoint[],
  field: "views" | "purchases" | "revenueCents" = "revenueCents",
): TrendPoint | null {
  let best: TrendPoint | null = null;
  for (const point of trend) {
    if (point[field] <= 0) continue;
    if (!best || point[field] > best[field]) best = point;
  }
  return best;
}

/**
 * A short human sentence describing the window, e.g. "30 days · daily buckets".
 * Rendered under the range picker.
 */
export function describeWindow(
  bucketCount: number,
  granularity: Granularity,
): string {
  const noun =
    granularity === "month"
      ? "monthly"
      : granularity === "week"
        ? "weekly"
        : "daily";
  const unit = granularity === "day" ? "days" : `${granularity}s`;
  return `${bucketCount} ${unit} · ${noun} buckets`;
}
