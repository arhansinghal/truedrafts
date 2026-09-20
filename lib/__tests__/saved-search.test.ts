import { describe, it, expect } from "vitest";
import {
  EMPTY_FILTERS,
  browseHref,
  describeFilters,
  filtersFromSearchParams,
  isEmptyFilters,
  normalizeFilters,
  parseFilters,
  searchParamsFromFilters,
  serializeFilters,
} from "../saved-search/filters";
import { isDue, windowStart } from "../saved-search/digest";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("normalizeFilters", () => {
  it("returns an empty filter set for junk", () => {
    expect(normalizeFilters(undefined)).toEqual(EMPTY_FILTERS);
    expect(normalizeFilters(null)).toEqual(EMPTY_FILTERS);
    expect(normalizeFilters(42)).toEqual(EMPTY_FILTERS);
    expect(normalizeFilters({ nonsense: true })).toEqual(EMPTY_FILTERS);
  });

  it("trims and collapses whitespace in the query", () => {
    expect(normalizeFilters({ q: "  robotics   club " }).q).toBe(
      "robotics club",
    );
    expect(normalizeFilters({ q: "   " }).q).toBe(null);
  });

  it("lower-cases the university slug", () => {
    expect(normalizeFilters({ university: "Stanford-University" }).university).toBe(
      "stanford-university",
    );
  });

  it("accepts years as an array or a comma string", () => {
    expect(normalizeFilters({ years: [2025, 2024] }).years).toEqual([2024, 2025]);
    expect(normalizeFilters({ years: "2025,2024" }).years).toEqual([2024, 2025]);
  });

  it("drops impossible years and duplicates", () => {
    expect(
      normalizeFilters({ years: [1200, 2025, 2025, 9999, NaN, 2024] }).years,
    ).toEqual([2024, 2025]);
  });

  it("lower-cases, de-duplicates and sorts tags", () => {
    expect(normalizeFilters({ tags: ["STEM", "stem", "Research"] }).tags).toEqual(
      ["research", "stem"],
    );
  });

  it("caps how many tags and years a search may pin", () => {
    const manyTags = Array.from({ length: 40 }, (_, i) => `tag${i}`);
    expect(normalizeFilters({ tags: manyTags }).tags.length).toBe(12);
    const manyYears = Array.from({ length: 40 }, (_, i) => 2000 + i);
    expect(normalizeFilters({ years: manyYears }).years.length).toBe(12);
  });

  it("rejects a non-positive or unparseable price", () => {
    expect(normalizeFilters({ maxPriceCents: 0 }).maxPriceCents).toBe(null);
    expect(normalizeFilters({ maxPriceCents: -5 }).maxPriceCents).toBe(null);
    expect(normalizeFilters({ maxPriceCents: "abc" }).maxPriceCents).toBe(null);
    expect(normalizeFilters({ maxPriceCents: "50000" }).maxPriceCents).toBe(50000);
  });

  it("floors a fractional price to whole paise", () => {
    expect(normalizeFilters({ maxPriceCents: 4999.7 }).maxPriceCents).toBe(4999);
  });

  it("accepts commonAppOnly as a boolean or the string 'true'", () => {
    expect(normalizeFilters({ commonAppOnly: true }).commonAppOnly).toBe(true);
    expect(normalizeFilters({ commonAppOnly: "true" }).commonAppOnly).toBe(true);
    expect(normalizeFilters({ commonAppOnly: "1" }).commonAppOnly).toBe(false);
    expect(normalizeFilters({ commonAppOnly: false }).commonAppOnly).toBe(false);
  });
});

describe("parseFilters", () => {
  it("survives malformed JSON", () => {
    expect(parseFilters("{not json")).toEqual(EMPTY_FILTERS);
    expect(parseFilters(null)).toEqual(EMPTY_FILTERS);
    expect(parseFilters("")).toEqual(EMPTY_FILTERS);
  });

  it("round-trips through serialize", () => {
    const filters = normalizeFilters({
      q: "robotics",
      university: "stanford-university",
      years: [2025],
      tags: ["stem"],
      maxPriceCents: 50000,
      commonAppOnly: true,
    });
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
  });

  it("writes keys in a stable order", () => {
    const a = serializeFilters(normalizeFilters({ q: "x", tags: ["b", "a"] }));
    const b = serializeFilters(normalizeFilters({ tags: ["a", "b"], q: "x" }));
    expect(a).toBe(b);
  });
});

describe("isEmptyFilters", () => {
  it("is true only when nothing is pinned", () => {
    expect(isEmptyFilters(EMPTY_FILTERS)).toBe(true);
    expect(isEmptyFilters(normalizeFilters({ q: "x" }))).toBe(false);
    expect(isEmptyFilters(normalizeFilters({ tags: ["stem"] }))).toBe(false);
    expect(isEmptyFilters(normalizeFilters({ commonAppOnly: true }))).toBe(false);
    expect(isEmptyFilters(normalizeFilters({ maxPriceCents: 1 }))).toBe(false);
  });
});

describe("URL round-trip", () => {
  it("reads Browse params into filters", () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams(
        "q=robotics&university=stanford-university&year=2025,2024&tags=stem,research&max_price=50000&common_app=1",
      ),
    );
    expect(filters.q).toBe("robotics");
    expect(filters.university).toBe("stanford-university");
    expect(filters.years).toEqual([2024, 2025]);
    expect(filters.tags).toEqual(["research", "stem"]);
    expect(filters.maxPriceCents).toBe(50000);
    expect(filters.commonAppOnly).toBe(false); // "1" is not the string "true"
  });

  it("writes filters back out to params", () => {
    const filters = normalizeFilters({
      q: "robotics",
      years: [2025],
      tags: ["stem"],
    });
    const params = searchParamsFromFilters(filters);
    expect(params.get("q")).toBe("robotics");
    expect(params.get("year")).toBe("2025");
    expect(params.get("tags")).toBe("stem");
    expect(params.get("university")).toBe(null);
  });

  it("survives a full round-trip", () => {
    const original = normalizeFilters({
      q: "first generation",
      university: "brown-university",
      years: [2023, 2025],
      tags: ["identity", "service"],
      maxPriceCents: 75000,
    });
    const roundTripped = filtersFromSearchParams(
      searchParamsFromFilters(original),
    );
    expect(roundTripped).toEqual(original);
  });

  it("links back to plain Browse when nothing is pinned", () => {
    expect(browseHref(EMPTY_FILTERS)).toBe("/applications");
  });

  it("links back to the filtered Browse otherwise", () => {
    expect(browseHref(normalizeFilters({ q: "robotics" }))).toBe(
      "/applications?q=robotics",
    );
  });
});

describe("describeFilters", () => {
  it("falls back to 'Everything' when nothing is pinned", () => {
    expect(describeFilters(EMPTY_FILTERS)).toBe("Everything");
  });

  it("title-cases a university slug", () => {
    expect(
      describeFilters(normalizeFilters({ university: "stanford-university" })),
    ).toBe("Stanford University");
  });

  it("stitches the pieces together", () => {
    const text = describeFilters(
      normalizeFilters({
        q: "robotics",
        university: "mit",
        years: [2025],
        tags: ["stem"],
        maxPriceCents: 50000,
      }),
    );
    expect(text).toContain('"robotics"');
    expect(text).toContain("Mit");
    expect(text).toContain("2025");
    expect(text).toContain("tagged stem");
    expect(text).toContain("under ₹500");
  });
});

describe("isDue", () => {
  it("never fires for a search with emails turned off", () => {
    expect(isDue({ cadence: "off", lastNotifiedAt: null }, NOW)).toBe(false);
    expect(
      isDue(
        { cadence: "off", lastNotifiedAt: new Date(NOW.getTime() - 90 * DAY_MS) },
        NOW,
      ),
    ).toBe(false);
  });

  it("fires immediately for a search that has never been notified", () => {
    expect(isDue({ cadence: "weekly", lastNotifiedAt: null }, NOW)).toBe(true);
  });

  it("respects the daily gap", () => {
    const justUnder = new Date(NOW.getTime() - (DAY_MS - 1000));
    const exactly = new Date(NOW.getTime() - DAY_MS);
    expect(isDue({ cadence: "daily", lastNotifiedAt: justUnder }, NOW)).toBe(false);
    expect(isDue({ cadence: "daily", lastNotifiedAt: exactly }, NOW)).toBe(true);
  });

  it("respects the weekly gap", () => {
    const sixDays = new Date(NOW.getTime() - 6 * DAY_MS);
    const sevenDays = new Date(NOW.getTime() - 7 * DAY_MS);
    expect(isDue({ cadence: "weekly", lastNotifiedAt: sixDays }, NOW)).toBe(false);
    expect(isDue({ cadence: "weekly", lastNotifiedAt: sevenDays }, NOW)).toBe(true);
  });

  it("ignores a cadence it doesn't recognise", () => {
    expect(isDue({ cadence: "hourly", lastNotifiedAt: null }, NOW)).toBe(false);
  });
});

describe("windowStart", () => {
  it("uses the watermark when there is one", () => {
    const mark = new Date(NOW.getTime() - 3 * DAY_MS);
    expect(windowStart(mark, NOW).toISOString()).toBe(mark.toISOString());
  });

  it("looks back a bounded window on the first run", () => {
    const start = windowStart(null, NOW);
    const days = (NOW.getTime() - start.getTime()) / DAY_MS;
    expect(days).toBe(14);
  });
});
