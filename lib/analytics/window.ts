/**
 * Date-window maths for the writer analytics dashboard.
 *
 * Every calculation in here is deliberately UTC-only. The dashboard is rendered
 * for writers all over the world, and the numbers must not shift depending on
 * where the request lands — Vercel functions run in UTC, `next dev` runs in the
 * developer's local zone, and both have to agree. Bucket keys are therefore
 * derived from UTC getters, never from `toLocaleDateString` or the local-time
 * `Date` constructor.
 */

import type { Granularity, RangeKey, Window } from "./types";

/** How many days each range covers, counting today as day 1. */
const RANGE_DAYS: Record<RangeKey, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};

/** Ranges longer than this many days roll up to coarser buckets. */
const WEEK_THRESHOLD_DAYS = 45;
const MONTH_THRESHOLD_DAYS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isRangeKey(value: unknown): value is RangeKey {
  return (
    value === "7d" || value === "30d" || value === "90d" || value === "12m"
  );
}

export function parseRangeKey(value: string | null | undefined): RangeKey {
  return isRangeKey(value) ? value : "30d";
}

export function rangeDays(range: RangeKey): number {
  return RANGE_DAYS[range];
}

/** Midnight UTC on the day `d` falls in. */
export function startOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

/** The last representable millisecond of the UTC day `d` falls in. */
export function endOfDayUTC(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

/** Midnight UTC on the Monday of the ISO week `d` falls in. */
export function startOfWeekUTC(d: Date): Date {
  const day = startOfDayUTC(d);
  // getUTCDay(): 0 = Sunday. Shift so Monday is the first day of the week.
  const offset = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - offset * DAY_MS);
}

/** Midnight UTC on the first of the month `d` falls in. */
export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

export function granularityFor(range: RangeKey): Granularity {
  const days = RANGE_DAYS[range];
  if (days > MONTH_THRESHOLD_DAYS) return "month";
  if (days > WEEK_THRESHOLD_DAYS) return "week";
  return "day";
}

/**
 * The inclusive window for `range`, anchored on `now`.
 *
 * A "7d" range is today plus the six days before it — seven whole UTC days —
 * not "the last 168 hours". Anchoring on day boundaries keeps the trend chart
 * from showing a half-empty leading bucket.
 */
export function windowFor(range: RangeKey, now: Date = new Date()): Window {
  const days = RANGE_DAYS[range];
  const end = endOfDayUTC(now);
  const start = startOfDayUTC(new Date(now.getTime() - (days - 1) * DAY_MS));
  return { start, end, granularity: granularityFor(range) };
}

/**
 * The window of the same length immediately before `w`, used for the
 * period-over-period deltas on the headline stats.
 *
 * `w` is inclusive on both ends, so the previous window has to stop one
 * millisecond before `w.start` — otherwise the boundary day would be counted in
 * both windows and every delta would be quietly inflated.
 */
export function previousWindow(w: Window): Window {
  const span = w.end.getTime() - w.start.getTime();
  const end = new Date(w.start.getTime() - 1);
  const start = new Date(end.getTime() - span);
  return { start, end, granularity: w.granularity };
}

/** `YYYY-MM-DD` for a UTC instant. */
export function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `YYYY-MM` for a UTC instant. */
export function ymUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * The bucket a timestamp belongs to, at the given granularity.
 *
 * Day and week buckets are both keyed `YYYY-MM-DD` — a week is keyed by its
 * Monday — so the chart can treat every key the same way.
 */
export function bucketKey(d: Date, granularity: Granularity): string {
  if (granularity === "month") return ymUTC(startOfMonthUTC(d));
  if (granularity === "week") return ymdUTC(startOfWeekUTC(d));
  return ymdUTC(startOfDayUTC(d));
}

/**
 * Every bucket key in `w`, in order, including empty ones.
 *
 * The chart needs the full scaffold so gaps render as zero rather than
 * collapsing the x-axis. Callers merge their aggregated rows onto this.
 */
export function enumerateBuckets(w: Window): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  let cursor: Date;
  if (w.granularity === "month") cursor = startOfMonthUTC(w.start);
  else if (w.granularity === "week") cursor = startOfWeekUTC(w.start);
  else cursor = startOfDayUTC(w.start);

  // Guard against a pathological window producing an unbounded loop: the
  // longest range we offer is 365 days, so 400 iterations is plenty of slack.
  let iterations = 0;
  while (cursor.getTime() <= w.end.getTime() && iterations < 400) {
    const key = bucketKey(cursor, w.granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    if (w.granularity === "month") {
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
    } else if (w.granularity === "week") {
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
    } else {
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
    iterations += 1;
  }

  return keys;
}

/**
 * Human label for a bucket key, e.g. `2026-09-19` → `19 Sep`.
 *
 * Parsed with explicit UTC parts rather than `new Date(key)` so the label can
 * never slide a day backwards for viewers behind UTC.
 */
export function bucketLabel(key: string, granularity: Granularity): string {
  const parts = key.split("-").map((n) => Number(n));
  const [year, month, day] = parts;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return key;
  const d = new Date(Date.UTC(year, month - 1, day ?? 1));
  if (granularity === "month") {
    return d.toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
