/**
 * Shared shapes for the writer analytics dashboard.
 *
 * Everything here is serialisable — the API route hands these straight to
 * `Response.json()` and the client dashboard renders them without any further
 * transformation. Dates cross the wire as `YYYY-MM-DD` bucket keys (UTC) so the
 * payload stays stable regardless of where it is rendered.
 */

/** Ranges the dashboard offers in its picker. */
export type RangeKey = "7d" | "30d" | "90d" | "12m";

/** How a range is chopped up for the trend chart. */
export type Granularity = "day" | "week" | "month";

/**
 * A closed, inclusive time window. `start` is the first instant that counts and
 * `end` is the last one — queries use `>= start AND <= end`, never `< end`.
 */
export type Window = {
  start: Date;
  end: Date;
  granularity: Granularity;
};

/** One point on the trend chart. */
export type TrendPoint = {
  /** UTC bucket key: `YYYY-MM-DD` for day/week, `YYYY-MM` for month. */
  key: string;
  views: number;
  previewOpens: number;
  purchases: number;
  revenueCents: number;
};

/** The view → preview → purchase funnel, scoped to the selected range. */
export type Funnel = {
  views: number;
  previewOpens: number;
  purchases: number;
  /** Percentage of viewers who opened the preview, 0–100, rounded. */
  viewToPreviewPct: number;
  /** Percentage of preview openers who bought, 0–100, rounded. */
  previewToPurchasePct: number;
  /** Percentage of viewers who bought, 0–100, rounded. */
  overallConversionPct: number;
};

/** Per-listing row in the performance table. */
export type ListingRow = {
  id: string;
  title: string;
  universityName: string;
  status: string;
  views: number;
  previewOpens: number;
  purchases: number;
  revenueCents: number;
  /** Purchases divided by views for this listing, 0–100, rounded. */
  conversionPct: number;
};

/** A headline number plus its change against the preceding window. */
export type Delta = {
  current: number;
  previous: number;
  /** Signed percentage change. `null` when the previous window was empty. */
  changePct: number | null;
};

export type AnalyticsPayload = {
  range: RangeKey;
  granularity: Granularity;
  /** Inclusive ISO timestamps for the window actually used. */
  startsAt: string;
  endsAt: string;
  trend: TrendPoint[];
  funnel: Funnel;
  listings: ListingRow[];
  revenue: Delta;
  sales: Delta;
  traffic: Delta;
};
