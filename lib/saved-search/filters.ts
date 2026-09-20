/**
 * The filter object behind a saved search.
 *
 * Browse is driven by URL params; a saved search is the same thing pinned to a
 * row. Both directions live here so the Browse page, the "save this search"
 * button and the digest job can never disagree about what a saved search means.
 *
 * Everything is normalised on the way in: trimmed, lower-cased where it should
 * be, de-duplicated, sorted, and clamped. Two readers who arrive at the same
 * filters from different URLs end up with byte-identical JSON.
 */

export type SavedSearchFilters = {
  /** Free-text query, as typed. */
  q: string | null;
  /** University slug, e.g. "stanford-university". */
  university: string | null;
  /** Admission years, ascending. */
  years: number[];
  /**
   * Tags the reader ticked. A listing must carry **all** of them to match —
   * these narrow, they don't widen.
   */
  tags: string[];
  /** Upper price bound in paise. */
  maxPriceCents: number | null;
  /** Only applications that include a Common App personal statement. */
  commonAppOnly: boolean;
};

export const EMPTY_FILTERS: SavedSearchFilters = {
  q: null,
  university: null,
  years: [],
  tags: [],
  maxPriceCents: null,
  commonAppOnly: false,
};

/** Applications can't predate the platform; anything older is a typo. */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/** Cap on how many tags/years a single saved search may pin. */
const MAX_TAGS = 12;
const MAX_YEARS = 12;

function cleanString(value: unknown, maxLength = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanYears(value: unknown): number[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const years = raw
    .map((y) => Number(String(y).trim()))
    .filter((y) => Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR);

  return Array.from(new Set(years))
    .sort((a, b) => a - b)
    .slice(0, MAX_YEARS);
}

function cleanTags(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const tags = raw
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 40);

  return Array.from(new Set(tags)).sort().slice(0, MAX_TAGS);
}

function cleanPrice(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/**
 * Normalise anything into a well-formed filter object. Never throws — junk
 * fields are dropped, not rejected, because this runs on stored JSON that may
 * predate the current shape.
 */
export function normalizeFilters(input: unknown): SavedSearchFilters {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    q: cleanString(raw.q),
    university: cleanString(raw.university, 120)?.toLowerCase() ?? null,
    years: cleanYears(raw.years),
    tags: cleanTags(raw.tags),
    maxPriceCents: cleanPrice(raw.maxPriceCents),
    commonAppOnly: raw.commonAppOnly === true || raw.commonAppOnly === "true",
  };
}

/** Parse the JSON column, falling back to an empty filter set. */
export function parseFilters(json: string | null | undefined): SavedSearchFilters {
  if (!json) return { ...EMPTY_FILTERS };
  try {
    return normalizeFilters(JSON.parse(json));
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

/** Serialise for storage. Keys are written in a fixed order so the JSON is stable. */
export function serializeFilters(filters: SavedSearchFilters): string {
  return JSON.stringify({
    q: filters.q,
    university: filters.university,
    years: filters.years,
    tags: filters.tags,
    maxPriceCents: filters.maxPriceCents,
    commonAppOnly: filters.commonAppOnly,
  });
}

/** True when nothing is pinned — a saved search that would match everything. */
export function isEmptyFilters(filters: SavedSearchFilters): boolean {
  return (
    !filters.q &&
    !filters.university &&
    filters.years.length === 0 &&
    filters.tags.length === 0 &&
    filters.maxPriceCents === null &&
    !filters.commonAppOnly
  );
}

/** Read filters out of a Browse URL's query string. */
export function filtersFromSearchParams(
  params: URLSearchParams | Record<string, string | undefined>,
): SavedSearchFilters {
  const get = (key: string): string | undefined =>
    params instanceof URLSearchParams
      ? (params.get(key) ?? undefined)
      : params[key];

  return normalizeFilters({
    q: get("q"),
    university: get("university"),
    years: get("year"),
    tags: get("tags"),
    maxPriceCents: get("max_price"),
    commonAppOnly: get("common_app"),
  });
}

/** Rebuild the Browse URL for a saved search. */
export function searchParamsFromFilters(
  filters: SavedSearchFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.university) params.set("university", filters.university);
  if (filters.years.length > 0) params.set("year", filters.years.join(","));
  if (filters.tags.length > 0) params.set("tags", filters.tags.join(","));
  if (filters.maxPriceCents !== null) {
    params.set("max_price", String(filters.maxPriceCents));
  }
  if (filters.commonAppOnly) params.set("common_app", "1");
  return params;
}

/** The Browse path a saved search links back to. */
export function browseHref(filters: SavedSearchFilters): string {
  const query = searchParamsFromFilters(filters).toString();
  return query ? `/applications?${query}` : "/applications";
}

/**
 * A short human description, used as the default name and in the digest email.
 * e.g. `"robotics" · Stanford · 2025 · tagged stem, research`
 */
export function describeFilters(filters: SavedSearchFilters): string {
  const parts: string[] = [];
  if (filters.q) parts.push(`"${filters.q}"`);
  if (filters.university) {
    parts.push(
      filters.university
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    );
  }
  if (filters.years.length > 0) parts.push(filters.years.join(", "));
  if (filters.tags.length > 0) parts.push(`tagged ${filters.tags.join(", ")}`);
  if (filters.maxPriceCents !== null) {
    parts.push(`under ₹${Math.floor(filters.maxPriceCents / 100)}`);
  }
  if (filters.commonAppOnly) parts.push("with a personal statement");

  return parts.length > 0 ? parts.join(" · ") : "Everything";
}
