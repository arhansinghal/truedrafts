import { describe, it, expect } from "vitest";
import {
  MIN_ROWS_FOR_DISTRIBUTIONS,
  buildInsights,
  demandStats,
  hasEnoughForDistributions,
  isPlausibleYear,
  missingYearCount,
  normalizeTag,
  percentile,
  priceStats,
  share,
  shapeStats,
  sortedAscending,
  tagFrequency,
  topMajors,
  yearHistogram,
  type InsightRow,
} from "../university-insights/stats";

let seq = 0;
function row(overrides: Partial<InsightRow> = {}): InsightRow {
  seq += 1;
  return {
    id: `app-${seq}`,
    priceCents: 50_000,
    admittedYear: 2025,
    tags: [],
    major: null,
    submittedCommonApp: true,
    numSupplementals: 2,
    purchases: 0,
    views: 0,
    ...overrides,
  };
}

describe("sortedAscending", () => {
  it("sorts numerically, not lexicographically", () => {
    expect(sortedAscending([10, 9, 100, 1])).toEqual([1, 9, 10, 100]);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    sortedAscending(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it("handles an empty array", () => {
    expect(sortedAscending([])).toEqual([]);
  });
});

describe("percentile", () => {
  it("has no answer for an empty array", () => {
    expect(percentile([], 0.5)).toBe(null);
  });

  it("returns the only value when there is one", () => {
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 1)).toBe(42);
  });

  it("returns the ends at p=0 and p=1", () => {
    const values = [1, 2, 3, 4, 5];
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(5);
  });

  it("returns the middle value for an odd-length array", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("interpolates between the two middle values for an even-length array", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it("interpolates between neighbours off the quartiles", () => {
    // rank = 0.25 * 3 = 0.75 → three quarters of the way from 1 to 2.
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
    expect(percentile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 10);
  });

  it("clamps a fraction outside [0, 1]", () => {
    expect(percentile([1, 2, 3], -5)).toBe(1);
    expect(percentile([1, 2, 3], 9)).toBe(3);
  });

  it("refuses a non-finite fraction rather than returning NaN", () => {
    expect(percentile([1, 2, 3], Number.NaN)).toBe(null);
    expect(percentile([1, 2, 3], Number.POSITIVE_INFINITY)).toBe(3);
  });

  it("copes with every value being identical", () => {
    expect(percentile([7, 7, 7, 7], 0.25)).toBe(7);
    expect(percentile([7, 7, 7, 7], 0.5)).toBe(7);
  });
});

describe("priceStats", () => {
  it("reports nulls rather than zeroes for an empty school", () => {
    const stats = priceStats([]);
    expect(stats.count).toBe(0);
    expect(stats.medianCents).toBe(null);
    expect(stats.minCents).toBe(null);
    expect(stats.meanCents).toBe(null);
  });

  it("describes a single listing without pretending to a spread", () => {
    const stats = priceStats([row({ priceCents: 49_900 })]);
    expect(stats.count).toBe(1);
    expect(stats.minCents).toBe(49_900);
    expect(stats.medianCents).toBe(49_900);
    expect(stats.maxCents).toBe(49_900);
    expect(stats.meanCents).toBe(49_900);
  });

  it("computes the five-number summary", () => {
    const stats = priceStats(
      [10_000, 20_000, 30_000, 40_000, 50_000].map((priceCents) =>
        row({ priceCents }),
      ),
    );
    expect(stats.minCents).toBe(10_000);
    expect(stats.p25Cents).toBe(20_000);
    expect(stats.medianCents).toBe(30_000);
    expect(stats.p75Cents).toBe(40_000);
    expect(stats.maxCents).toBe(50_000);
    expect(stats.meanCents).toBe(30_000);
  });

  it("does not depend on the order rows arrive in", () => {
    const prices = [50_000, 10_000, 30_000, 20_000, 40_000];
    const shuffled = priceStats(prices.map((priceCents) => row({ priceCents })));
    expect(shuffled.medianCents).toBe(30_000);
    expect(shuffled.minCents).toBe(10_000);
  });

  it("rounds an interpolated percentile to whole paise", () => {
    const stats = priceStats(
      [10_001, 20_002, 30_003, 40_004].map((priceCents) => row({ priceCents })),
    );
    expect(Number.isInteger(stats.medianCents)).toBe(true);
    expect(Number.isInteger(stats.p25Cents)).toBe(true);
    expect(Number.isInteger(stats.meanCents)).toBe(true);
  });

  it("ignores negative or non-finite prices", () => {
    const stats = priceStats([
      row({ priceCents: 10_000 }),
      row({ priceCents: -5 }),
      row({ priceCents: Number.NaN }),
      row({ priceCents: 30_000 }),
    ]);
    expect(stats.count).toBe(2);
    expect(stats.minCents).toBe(10_000);
    expect(stats.maxCents).toBe(30_000);
  });
});

describe("share", () => {
  it("rounds to whole percentages", () => {
    expect(share(1, 3)).toBe(33);
    expect(share(2, 3)).toBe(67);
    expect(share(1, 1)).toBe(100);
  });

  it("distinguishes 'none of them' from 'nothing to divide'", () => {
    expect(share(0, 10)).toBe(0);
    expect(share(0, 0)).toBe(null);
    expect(share(5, 0)).toBe(null);
  });
});

describe("normalizeTag", () => {
  it("turns a stored slug into a readable label", () => {
    expect(normalizeTag("first_gen")).toBe("first gen");
    expect(normalizeTag("  STEM  ")).toBe("stem");
    expect(normalizeTag("community   service")).toBe("community service");
  });
});

describe("tagFrequency", () => {
  it("returns nothing when no row is tagged", () => {
    expect(tagFrequency([row(), row()])).toEqual([]);
  });

  it("counts rows, not tag occurrences", () => {
    const counts = tagFrequency([row({ tags: ["stem", "STEM", "stem"] })]);
    expect(counts).toHaveLength(1);
    expect(counts[0].count).toBe(1);
  });

  it("orders by frequency, then alphabetically for ties", () => {
    const counts = tagFrequency([
      row({ tags: ["service", "stem"] }),
      row({ tags: ["stem"] }),
      row({ tags: ["arts", "service"] }),
    ]);
    expect(counts.map((c) => c.tag)).toEqual(["service", "stem", "arts"]);
  });

  it("reports each tag's share of all applications", () => {
    const counts = tagFrequency([
      row({ tags: ["stem"] }),
      row({ tags: ["stem"] }),
      row({ tags: [] }),
      row({ tags: [] }),
    ]);
    expect(counts[0].sharePct).toBe(50);
  });

  it("honours the limit", () => {
    const rows = ["a", "b", "c", "d", "e"].map((tag) => row({ tags: [tag] }));
    expect(tagFrequency(rows, 3)).toHaveLength(3);
    expect(tagFrequency(rows, 0)).toHaveLength(0);
  });

  it("tolerates a null tags column", () => {
    expect(tagFrequency([row({ tags: null })])).toEqual([]);
  });

  it("drops tags that normalise to nothing", () => {
    expect(tagFrequency([row({ tags: ["   ", "_"] })])).toEqual([]);
  });
});

describe("yearHistogram", () => {
  it("returns nothing when no year is recorded", () => {
    expect(yearHistogram([row({ admittedYear: null })])).toEqual([]);
  });

  it("counts per year", () => {
    const buckets = yearHistogram([
      row({ admittedYear: 2024 }),
      row({ admittedYear: 2024 }),
      row({ admittedYear: 2025 }),
    ]);
    expect(buckets).toEqual([
      { year: 2024, count: 2 },
      { year: 2025, count: 1 },
    ]);
  });

  it("fills quiet years in between with zeroes", () => {
    const buckets = yearHistogram([
      row({ admittedYear: 2021 }),
      row({ admittedYear: 2024 }),
    ]);
    expect(buckets.map((b) => b.year)).toEqual([2021, 2022, 2023, 2024]);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 0, 1]);
  });

  it("does not pad outside the observed range", () => {
    const buckets = yearHistogram([row({ admittedYear: 2025 })]);
    expect(buckets).toEqual([{ year: 2025, count: 1 }]);
  });

  it("ignores impossible years instead of spanning centuries", () => {
    const buckets = yearHistogram([
      row({ admittedYear: 20 }),
      row({ admittedYear: 2024 }),
      row({ admittedYear: 2025 }),
    ]);
    expect(buckets.map((b) => b.year)).toEqual([2024, 2025]);
  });
});

describe("isPlausibleYear / missingYearCount", () => {
  it("accepts real years and rejects the rest", () => {
    expect(isPlausibleYear(2025)).toBe(true);
    expect(isPlausibleYear(null)).toBe(false);
    expect(isPlausibleYear(20)).toBe(false);
    expect(isPlausibleYear(2025.5)).toBe(false);
  });

  it("counts the rows a histogram had to leave out", () => {
    expect(
      missingYearCount([
        row({ admittedYear: 2025 }),
        row({ admittedYear: null }),
        row({ admittedYear: 12 }),
      ]),
    ).toBe(2);
  });
});

describe("shapeStats", () => {
  it("reports nulls rather than zeroes for an empty school", () => {
    const stats = shapeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.commonAppSharePct).toBe(null);
    expect(stats.meanSupplementals).toBe(null);
  });

  it("counts personal statements and shares them", () => {
    const stats = shapeStats([
      row({ submittedCommonApp: true }),
      row({ submittedCommonApp: true }),
      row({ submittedCommonApp: false }),
      row({ submittedCommonApp: null }),
    ]);
    expect(stats.withCommonApp).toBe(2);
    expect(stats.commonAppSharePct).toBe(50);
  });

  it("averages supplementals to one decimal", () => {
    const stats = shapeStats([
      row({ numSupplementals: 1 }),
      row({ numSupplementals: 2 }),
      row({ numSupplementals: 4 }),
    ]);
    expect(stats.meanSupplementals).toBe(2.3);
    expect(stats.maxSupplementals).toBe(4);
  });

  it("treats a missing or negative supplemental count as zero", () => {
    const stats = shapeStats([
      row({ numSupplementals: null }),
      row({ numSupplementals: -3 }),
      row({ numSupplementals: 4 }),
    ]);
    expect(stats.meanSupplementals).toBe(1.3);
    expect(stats.maxSupplementals).toBe(4);
  });
});

describe("topMajors", () => {
  it("returns nothing when nobody named a major", () => {
    expect(topMajors([row({ major: null }), row({ major: "  " })])).toEqual([]);
  });

  it("shares against the rows that named one, not every row", () => {
    const majors = topMajors([
      row({ major: "Engineering" }),
      row({ major: "engineering" }),
      row({ major: "History" }),
      row({ major: null }),
      row({ major: null }),
    ]);
    expect(majors[0].major).toBe("engineering");
    expect(majors[0].count).toBe(2);
    // 2 of the 3 rows that declared a major, not 2 of 5.
    expect(majors[0].sharePct).toBe(67);
  });

  it("breaks ties alphabetically", () => {
    const majors = topMajors([
      row({ major: "physics" }),
      row({ major: "biology" }),
    ]);
    expect(majors.map((m) => m.major)).toEqual(["biology", "physics"]);
  });
});

describe("demandStats", () => {
  it("is empty and unconverted for an empty school", () => {
    const stats = demandStats([]);
    expect(stats.totalViews).toBe(0);
    expect(stats.conversionPct).toBe(null);
  });

  it("totals views and purchases and takes the ratio", () => {
    const stats = demandStats([
      row({ views: 100, purchases: 4 }),
      row({ views: 100, purchases: 6 }),
    ]);
    expect(stats.totalViews).toBe(200);
    expect(stats.totalPurchases).toBe(10);
    expect(stats.conversionPct).toBe(5);
  });

  it("does not divide by zero views", () => {
    const stats = demandStats([row({ views: 0, purchases: 0 })]);
    expect(stats.conversionPct).toBe(null);
  });
});

describe("buildInsights", () => {
  it("renders an empty school without throwing", () => {
    const insights = buildInsights([]);
    expect(insights.total).toBe(0);
    expect(insights.tags).toEqual([]);
    expect(insights.years).toEqual([]);
    expect(insights.price.medianCents).toBe(null);
  });

  it("threads a realistic school through every section", () => {
    const insights = buildInsights([
      row({ priceCents: 30_000, admittedYear: 2024, tags: ["stem"], major: "cs", views: 120, purchases: 6 }),
      row({ priceCents: 50_000, admittedYear: 2025, tags: ["stem", "service"], major: "cs", views: 80, purchases: 4 }),
      row({ priceCents: 70_000, admittedYear: 2025, tags: ["service"], major: null, views: 0, purchases: 0 }),
    ]);

    expect(insights.total).toBe(3);
    expect(insights.price.medianCents).toBe(50_000);
    expect(insights.tags.map((t) => t.tag)).toEqual(["service", "stem"]);
    expect(insights.years).toEqual([
      { year: 2024, count: 1 },
      { year: 2025, count: 2 },
    ]);
    expect(insights.majors[0]).toEqual({ major: "cs", count: 2, sharePct: 100 });
    expect(insights.demand.totalViews).toBe(200);
  });
});

describe("hasEnoughForDistributions", () => {
  it("gates on the documented threshold", () => {
    expect(hasEnoughForDistributions(MIN_ROWS_FOR_DISTRIBUTIONS - 1)).toBe(false);
    expect(hasEnoughForDistributions(MIN_ROWS_FOR_DISTRIBUTIONS)).toBe(true);
    expect(hasEnoughForDistributions(0)).toBe(false);
  });
});
