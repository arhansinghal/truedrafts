import { describe, it, expect } from "vitest";
import {
  buildFunnel,
  buildListingRows,
  buildTrend,
  countsByListing,
  delta,
  describeWindow,
  pct,
  peakBucket,
  totalOf,
  type EventRow,
  type ListingMeta,
  type SaleRow,
} from "../analytics/metrics";
import { windowFor } from "../analytics/window";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const W7 = windowFor("7d", NOW);

const APP_A = "11111111-1111-1111-1111-111111111111";
const APP_B = "22222222-2222-2222-2222-222222222222";

function view(listingId: string, iso: string): EventRow {
  return {
    essayId: null,
    applicationId: listingId,
    kind: "view",
    occurredAt: new Date(iso),
  };
}

function preview(listingId: string, iso: string): EventRow {
  return {
    essayId: null,
    applicationId: listingId,
    kind: "preview_open",
    occurredAt: new Date(iso),
  };
}

function sale(listingId: string, iso: string, payoutCents: number): SaleRow {
  return {
    essayId: null,
    applicationId: listingId,
    writerPayoutCents: payoutCents,
    purchasedAt: new Date(iso),
  };
}

describe("pct", () => {
  it("rounds to whole percentages", () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(1, 2)).toBe(50);
  });

  it("reports an empty denominator as zero rather than NaN", () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
  });
});

describe("delta", () => {
  it("echoes both figures", () => {
    const d = delta(120, 80);
    expect(d.current).toBe(120);
    expect(d.previous).toBe(80);
  });

  it("reports no change as zero", () => {
    expect(delta(500, 500).changePct).toBe(0);
    expect(delta(0, 0).changePct).toBe(null);
  });

  it("has no percentage to report when the previous window was empty", () => {
    expect(delta(42, 0).changePct).toBe(null);
  });
});

describe("buildTrend", () => {
  it("lays every bucket in the window out, including empty ones", () => {
    const trend = buildTrend(W7, [], []);
    expect(trend).toHaveLength(7);
    expect(trend[0].key).toBe("2026-09-13");
    expect(trend.every((p) => p.views === 0 && p.revenueCents === 0)).toBe(true);
  });

  it("folds events onto the right day", () => {
    const trend = buildTrend(
      W7,
      [
        view(APP_A, "2026-09-15T08:00:00.000Z"),
        view(APP_A, "2026-09-15T20:00:00.000Z"),
        preview(APP_A, "2026-09-15T20:05:00.000Z"),
        view(APP_B, "2026-09-18T11:00:00.000Z"),
      ],
      [],
    );
    const sep15 = trend.find((p) => p.key === "2026-09-15")!;
    expect(sep15.views).toBe(2);
    expect(sep15.previewOpens).toBe(1);
    const sep18 = trend.find((p) => p.key === "2026-09-18")!;
    expect(sep18.views).toBe(1);
    expect(sep18.previewOpens).toBe(0);
  });

  it("folds sales and their revenue onto the right day", () => {
    const trend = buildTrend(
      W7,
      [],
      [
        sale(APP_A, "2026-09-16T09:00:00.000Z", 25000),
        sale(APP_B, "2026-09-16T17:30:00.000Z", 40000),
        sale(APP_A, "2026-09-19T01:00:00.000Z", 25000),
      ],
    );
    const sep16 = trend.find((p) => p.key === "2026-09-16")!;
    expect(sep16.purchases).toBe(2);
    expect(sep16.revenueCents).toBe(65000);
    expect(totalOf(trend, "revenueCents")).toBe(90000);
    expect(totalOf(trend, "purchases")).toBe(3);
  });

  it("ignores rows that fall outside the window", () => {
    const trend = buildTrend(
      W7,
      [view(APP_A, "2026-01-01T00:00:00.000Z")],
      [sale(APP_A, "2026-01-01T00:00:00.000Z", 9999)],
    );
    expect(totalOf(trend, "views")).toBe(0);
    expect(totalOf(trend, "revenueCents")).toBe(0);
  });
});

describe("buildFunnel", () => {
  it("derives every stage from the same trend", () => {
    const trend = buildTrend(
      W7,
      [
        ...Array.from({ length: 100 }, () =>
          view(APP_A, "2026-09-15T08:00:00.000Z"),
        ),
        ...Array.from({ length: 20 }, () =>
          preview(APP_A, "2026-09-15T09:00:00.000Z"),
        ),
      ],
      [
        sale(APP_A, "2026-09-15T10:00:00.000Z", 25000),
        sale(APP_A, "2026-09-15T11:00:00.000Z", 25000),
      ],
    );

    const funnel = buildFunnel(trend);
    expect(funnel.views).toBe(100);
    expect(funnel.previewOpens).toBe(20);
    expect(funnel.purchases).toBe(2);
    expect(funnel.viewToPreviewPct).toBe(20);
    expect(funnel.previewToPurchasePct).toBe(10);
    expect(funnel.overallConversionPct).toBe(2);
  });

  it("is all zeroes for an empty window", () => {
    const funnel = buildFunnel(buildTrend(W7, [], []));
    expect(funnel).toEqual({
      views: 0,
      previewOpens: 0,
      purchases: 0,
      viewToPreviewPct: 0,
      previewToPurchasePct: 0,
      overallConversionPct: 0,
    });
  });
});

describe("countsByListing", () => {
  it("splits events and sales per listing", () => {
    const counts = countsByListing(
      [
        view(APP_A, "2026-09-15T08:00:00.000Z"),
        view(APP_A, "2026-09-16T08:00:00.000Z"),
        preview(APP_B, "2026-09-16T08:00:00.000Z"),
      ],
      [sale(APP_B, "2026-09-16T09:00:00.000Z", 30000)],
    );

    expect(counts.get(APP_A)).toEqual({
      views: 2,
      previewOpens: 0,
      purchases: 0,
      revenueCents: 0,
    });
    expect(counts.get(APP_B)).toEqual({
      views: 0,
      previewOpens: 1,
      purchases: 1,
      revenueCents: 30000,
    });
  });

  it("handles legacy essay rows too", () => {
    const counts = countsByListing(
      [
        {
          essayId: "essay-1",
          applicationId: null,
          kind: "view",
          occurredAt: new Date("2026-09-15T08:00:00.000Z"),
        },
      ],
      [],
    );
    expect(counts.get("essay-1")?.views).toBe(1);
  });
});

describe("buildListingRows", () => {
  const listings: ListingMeta[] = [
    {
      id: APP_A,
      title: "Stanford — Class of 2029",
      universityName: "Stanford University",
      status: "approved",
      lifetimeViews: 40,
      lifetimePurchases: 1,
    },
    {
      id: APP_B,
      title: "Brown — Class of 2028",
      universityName: "Brown University",
      status: "approved",
      lifetimeViews: 120,
      lifetimePurchases: 2,
    },
  ];

  const counts = countsByListing(
    [
      ...Array.from({ length: 40 }, () =>
        view(APP_A, "2026-09-15T08:00:00.000Z"),
      ),
      ...Array.from({ length: 100 }, () =>
        view(APP_B, "2026-09-15T08:00:00.000Z"),
      ),
    ],
    [
      sale(APP_A, "2026-09-16T09:00:00.000Z", 20000),
      sale(APP_B, "2026-09-16T09:00:00.000Z", 30000),
      sale(APP_B, "2026-09-17T09:00:00.000Z", 30000),
    ],
  );

  it("sorts by revenue, highest first", () => {
    const rows = buildListingRows(listings, counts);
    expect(rows.map((r) => r.id)).toEqual([APP_B, APP_A]);
    expect(rows[0].revenueCents).toBe(60000);
  });

  it("carries the windowed counts through", () => {
    const rows = buildListingRows(listings, counts);
    const brown = rows.find((r) => r.id === APP_B)!;
    expect(brown.views).toBe(100);
    expect(brown.purchases).toBe(2);
  });

  it("gives listings with no activity a zero row rather than dropping them", () => {
    const rows = buildListingRows(listings, new Map());
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revenueCents === 0 && r.views === 0)).toBe(true);
  });
});

describe("peakBucket", () => {
  it("finds the best bucket by revenue", () => {
    const trend = buildTrend(
      W7,
      [],
      [
        sale(APP_A, "2026-09-14T09:00:00.000Z", 10000),
        sale(APP_A, "2026-09-17T09:00:00.000Z", 50000),
      ],
    );
    expect(peakBucket(trend)?.key).toBe("2026-09-17");
  });

  it("returns null when nothing happened", () => {
    expect(peakBucket(buildTrend(W7, [], []))).toBe(null);
  });
});

describe("describeWindow", () => {
  it("describes each granularity", () => {
    expect(describeWindow(30, "day")).toBe("30 days · daily buckets");
    expect(describeWindow(13, "week")).toBe("13 weeks · weekly buckets");
    expect(describeWindow(12, "month")).toBe("12 months · monthly buckets");
  });
});
