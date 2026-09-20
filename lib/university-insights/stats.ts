/**
 * Descriptive statistics for a university's published applications.
 *
 * Pure functions over plain rows: the query layer fetches, these fold, the page
 * renders. No database, no clock, no locale — so every number on the insights
 * page is reproducible from a fixed array in a test.
 *
 * Two rules everything here follows:
 *
 *   1. An empty input is never an error. Small schools legitimately have two
 *      applications, or none. Every function returns a shape the page can
 *      render — `null` for "no answer exists", never `NaN`.
 *   2. Money stays in integer paise until the moment it is displayed. Averages
 *      are rounded to whole paise so they can be handed to `formatCents`.
 */

/** The fields the insights page needs off each application. */
export type InsightRow = {
  id: string;
  priceCents: number;
  admittedYear: number | null;
  tags: string[] | null;
  major: string | null;
  submittedCommonApp: boolean | null;
  numSupplementals: number | null;
  purchases: number;
  views: number;
};

/** Ascending copy. Callers never mutate what they were handed. */
export function sortedAscending(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * The p-th percentile of an ascending array, interpolating between
 * neighbours (the same method as `PERCENTILE.INC` and numpy's default).
 *
 * `p` is a fraction in [0, 1]; anything outside is clamped. Returns null for an
 * empty array, because there is no such value — not 0, which would read as
 * "this school's essays are free".
 */
export function percentile(ascending: readonly number[], p: number): number | null {
  if (ascending.length === 0) return null;
  // NaN would survive both Math.min and Math.max and poison the interpolation.
  // Infinities are fine: they clamp like any other out-of-range fraction.
  if (Number.isNaN(p)) return null;
  if (ascending.length === 1) return ascending[0];

  const clamped = Math.min(1, Math.max(0, p));
  const rank = clamped * (ascending.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) return ascending[lower];

  const weight = rank - lower;
  return ascending[lower] + (ascending[upper] - ascending[lower]) * weight;
}

export type PriceStats = {
  count: number;
  minCents: number | null;
  p25Cents: number | null;
  medianCents: number | null;
  p75Cents: number | null;
  maxCents: number | null;
  meanCents: number | null;
};

/**
 * Price spread across a school's listings.
 *
 * Percentiles are rounded to whole paise: an interpolated median can land on a
 * fraction, and half a paisa is not a price anyone can pay.
 */
export function priceStats(rows: readonly InsightRow[]): PriceStats {
  const prices = sortedAscending(
    rows
      .map((row) => row.priceCents)
      .filter((price) => Number.isFinite(price) && price >= 0),
  );

  if (prices.length === 0) {
    return {
      count: 0,
      minCents: null,
      p25Cents: null,
      medianCents: null,
      p75Cents: null,
      maxCents: null,
      meanCents: null,
    };
  }

  const round = (value: number | null): number | null =>
    value === null ? null : Math.round(value);

  const total = prices.reduce((sum, price) => sum + price, 0);

  return {
    count: prices.length,
    minCents: prices[0],
    p25Cents: round(percentile(prices, 0.25)),
    medianCents: round(percentile(prices, 0.5)),
    p75Cents: round(percentile(prices, 0.75)),
    maxCents: prices[prices.length - 1],
    meanCents: Math.round(total / prices.length),
  };
}

/**
 * A whole-number percentage of `part` out of `whole`.
 *
 * Returns null when there is nothing to take a share of — "0%" and "no data"
 * are different claims and the page renders them differently.
 */
export function share(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** Tidy a tag for display: `first_gen` → `first gen`. */
export function normalizeTag(tag: string): string {
  return tag.replace(/_/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export type TagCount = {
  tag: string;
  count: number;
  /** Percentage of applications carrying this tag, 0–100. */
  sharePct: number;
};

/**
 * The themes that come up most often, most frequent first.
 *
 * Ties break alphabetically so the list is stable between renders — otherwise
 * two tags with the same count could swap places on every page load and look
 * like the data changed.
 */
export function tagFrequency(
  rows: readonly InsightRow[],
  limit = 12,
): TagCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    // One row counts once per distinct tag, even if it lists a tag twice.
    const seen = new Set<string>();
    for (const raw of row.tags ?? []) {
      const tag = normalizeTag(raw);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([tag, count]) => ({
      tag,
      count,
      sharePct: share(count, rows.length) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, Math.max(0, limit));
}

export type YearBucket = {
  year: number;
  count: number;
};

/**
 * Applications per admission year, oldest first, with quiet years filled in as
 * zeroes so the bars stay evenly spaced.
 *
 * Rows with no `admittedYear` are left out rather than bucketed into a fake
 * year; the page reports that count separately.
 */
export function yearHistogram(rows: readonly InsightRow[]): YearBucket[] {
  const counts = new Map<number, number>();

  for (const row of rows) {
    if (!isPlausibleYear(row.admittedYear)) continue;
    const year = row.admittedYear as number;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }

  if (counts.size === 0) return [];

  const years = Array.from(counts.keys());
  const first = Math.min(...years);
  const last = Math.max(...years);

  const buckets: YearBucket[] = [];
  for (let year = first; year <= last; year++) {
    buckets.push({ year, count: counts.get(year) ?? 0 });
  }
  return buckets;
}

/**
 * Admission years outside this range are data entry accidents, not history.
 * Bounding them also bounds the gap-filling loop above.
 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

export function isPlausibleYear(year: number | null): boolean {
  return (
    year !== null &&
    Number.isInteger(year) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR
  );
}

/** How many rows have no usable admission year recorded. */
export function missingYearCount(rows: readonly InsightRow[]): number {
  return rows.filter((row) => !isPlausibleYear(row.admittedYear)).length;
}

export type ShapeStats = {
  total: number;
  /** How many include a Common App personal statement. */
  withCommonApp: number;
  /** Percentage of applications including one, or null when there are none. */
  commonAppSharePct: number | null;
  /** Mean supplemental count, to one decimal place. Null when there are none. */
  meanSupplementals: number | null;
  /** The most supplementals any one application carries. */
  maxSupplementals: number;
};

/** What a typical application to this school actually contains. */
export function shapeStats(rows: readonly InsightRow[]): ShapeStats {
  if (rows.length === 0) {
    return {
      total: 0,
      withCommonApp: 0,
      commonAppSharePct: null,
      meanSupplementals: null,
      maxSupplementals: 0,
    };
  }

  let withCommonApp = 0;
  let supplementalTotal = 0;
  let maxSupplementals = 0;

  for (const row of rows) {
    if (row.submittedCommonApp) withCommonApp += 1;
    const supplementals = Math.max(0, row.numSupplementals ?? 0);
    supplementalTotal += supplementals;
    if (supplementals > maxSupplementals) maxSupplementals = supplementals;
  }

  return {
    total: rows.length,
    withCommonApp,
    commonAppSharePct: share(withCommonApp, rows.length),
    // One decimal: "2.4 supplementals" is useful, "2.3809523809" is not.
    meanSupplementals:
      Math.round((supplementalTotal / rows.length) * 10) / 10,
    maxSupplementals,
  };
}

export type MajorCount = {
  major: string;
  count: number;
  sharePct: number;
};

/**
 * The majors that show up most often. Same tie-breaking as `tagFrequency`.
 *
 * Only rows that actually declare a major count towards the share, so "38% of
 * applications that named a major named engineering" — not 38% of all rows,
 * which would quietly understate it whenever the inference step failed.
 */
export function topMajors(
  rows: readonly InsightRow[],
  limit = 6,
): MajorCount[] {
  const counts = new Map<string, number>();
  let declared = 0;

  for (const row of rows) {
    const major = row.major?.trim().toLowerCase();
    if (!major) continue;
    declared += 1;
    counts.set(major, (counts.get(major) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([major, count]) => ({
      major,
      count,
      sharePct: share(count, declared) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.major.localeCompare(b.major))
    .slice(0, Math.max(0, limit));
}

export type DemandStats = {
  totalViews: number;
  totalPurchases: number;
  /** Purchases per hundred views, 0–100. Null when nothing has been viewed. */
  conversionPct: number | null;
};

/**
 * How this school's listings perform as a group.
 *
 * Both figures are lifetime counters off the listing rows, so they describe the
 * same span of time as each other — which is what makes the ratio meaningful.
 */
export function demandStats(rows: readonly InsightRow[]): DemandStats {
  let totalViews = 0;
  let totalPurchases = 0;

  for (const row of rows) {
    totalViews += Math.max(0, row.views ?? 0);
    totalPurchases += Math.max(0, row.purchases ?? 0);
  }

  return {
    totalViews,
    totalPurchases,
    conversionPct: share(totalPurchases, totalViews),
  };
}

export type UniversityInsights = {
  total: number;
  price: PriceStats;
  tags: TagCount[];
  years: YearBucket[];
  missingYears: number;
  shape: ShapeStats;
  majors: MajorCount[];
  demand: DemandStats;
};

/** Everything the insights page renders, from one pass over the rows. */
export function buildInsights(rows: readonly InsightRow[]): UniversityInsights {
  return {
    total: rows.length,
    price: priceStats(rows),
    tags: tagFrequency(rows),
    years: yearHistogram(rows),
    missingYears: missingYearCount(rows),
    shape: shapeStats(rows),
    majors: topMajors(rows),
    demand: demandStats(rows),
  };
}

/**
 * Below this many applications the page shows the listings but hides the
 * distributions. A median of three numbers is not an insight, it is noise
 * dressed up as one.
 */
export const MIN_ROWS_FOR_DISTRIBUTIONS = 5;

export function hasEnoughForDistributions(total: number): boolean {
  return total >= MIN_ROWS_FOR_DISTRIBUTIONS;
}
