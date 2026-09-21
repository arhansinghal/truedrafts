// Parsing for the query params behind the /applications and /essays listings.
//
// These values come straight off the URL, so every one of them is attacker- (or
// crawler-) controlled. They end up in an OFFSET, an IN (...) and an ORDER BY,
// which is exactly where a NaN or an unbounded list stops being a cosmetic
// problem: `Math.max(1, parseInt("x"))` is NaN, `(NaN - 1) * 18` is NaN, and
// Postgres rejects `OFFSET NaN` with a 500 on a public page.

/** Page numbers past this are crawler noise; the listing has ~40 pages. */
export const MAX_PAGE = 500;

/** Earliest admit year worth filtering on. */
export const MIN_ADMIT_YEAR = 2000;

/** Most year filters we put in a single IN (...). */
export const MAX_YEAR_FILTERS = 20;

/**
 * 1-based page number, clamped to [1, maxPage].
 *
 * Anything unparseable ("", "abc", "-3", "1e999") falls back to page 1 rather
 * than erroring — a junk ?page= should render the first page, not a 500.
 * Trailing garbage is tolerated the way parseInt always has ("12abc" → 12);
 * the value is clamped either way, so it cannot reach the query malformed.
 */
export function parsePage(raw: string | undefined, maxPage: number = MAX_PAGE): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, maxPage);
}

/**
 * Comma-separated admit years → a sorted, de-duplicated, bounded list.
 *
 * Out-of-range and non-numeric entries are dropped rather than failing the
 * whole filter: a stale bookmark with one bad year should still return the
 * other years' results. An empty array means "no year filter".
 */
export function parseYearList(
  raw: string | undefined,
  maxYear: number = new Date().getUTCFullYear() + 1,
): number[] {
  if (!raw) return [];

  const years = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number.parseInt(part.trim(), 10);
    if (!Number.isInteger(n)) continue;
    if (n < MIN_ADMIT_YEAR || n > maxYear) continue;
    years.add(n);
    if (years.size >= MAX_YEAR_FILTERS) break;
  }

  return [...years].sort((a, b) => a - b);
}

/**
 * Whitelist a sort key. Returns `fallback` for anything not in `allowed`, so
 * the value is always safe to use as an index into a sort-column map.
 */
export function parseSort<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}
