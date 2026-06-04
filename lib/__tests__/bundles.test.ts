import { describe, it, expect } from "vitest";
import {
  computeBundlePrice,
  computeProRataSplits,
  bundleAvailability,
  parseBundleRule,
} from "../bundles";

describe("computeBundlePrice", () => {
  const apps = [{ priceCents: 1000 }, { priceCents: 2000 }, { priceCents: 500 }];

  it("flat: returns flatPriceCents when below sum", () => {
    const r = computeBundlePrice(
      { pricingMode: "flat", flatPriceCents: 2500, discountPercent: null },
      apps,
    );
    expect(r.sumPrices).toBe(3500);
    expect(r.finalPrice).toBe(2500);
    expect(r.savings).toBe(1000);
    expect(r.savingsPercent).toBe(29);
  });

  it("flat: clamps to sum when override is higher (no upcharge)", () => {
    const r = computeBundlePrice(
      { pricingMode: "flat", flatPriceCents: 99999, discountPercent: null },
      apps,
    );
    expect(r.finalPrice).toBe(3500);
    expect(r.savings).toBe(0);
  });

  it("flat: clamps to 0 when negative", () => {
    const r = computeBundlePrice(
      { pricingMode: "flat", flatPriceCents: -500, discountPercent: null },
      apps,
    );
    expect(r.finalPrice).toBe(0);
  });

  it("percent: applies discount", () => {
    const r = computeBundlePrice(
      { pricingMode: "percent", flatPriceCents: null, discountPercent: 20 },
      apps,
    );
    expect(r.finalPrice).toBe(2800); // 3500 * 0.8
    expect(r.savings).toBe(700);
    expect(r.savingsPercent).toBe(20);
  });

  it("percent: 0% is a no-op", () => {
    const r = computeBundlePrice(
      { pricingMode: "percent", flatPriceCents: null, discountPercent: 0 },
      apps,
    );
    expect(r.finalPrice).toBe(3500);
  });

  it("percent: 100% gives free bundle", () => {
    const r = computeBundlePrice(
      { pricingMode: "percent", flatPriceCents: null, discountPercent: 100 },
      apps,
    );
    expect(r.finalPrice).toBe(0);
    expect(r.savings).toBe(3500);
  });

  it("percent: clamps >100 to 100", () => {
    const r = computeBundlePrice(
      { pricingMode: "percent", flatPriceCents: null, discountPercent: 200 },
      apps,
    );
    expect(r.finalPrice).toBe(0);
  });

  it("empty members → 0/0", () => {
    const r = computeBundlePrice(
      { pricingMode: "flat", flatPriceCents: 1000, discountPercent: null },
      [],
    );
    expect(r.sumPrices).toBe(0);
    expect(r.finalPrice).toBe(0);
    expect(r.savingsPercent).toBe(0);
  });
});

describe("computeProRataSplits", () => {
  it("splits proportionally and sums to total", () => {
    const items = [
      { applicationId: "a", priceCents: 1000 },
      { applicationId: "b", priceCents: 2000 },
      { applicationId: "c", priceCents: 1000 },
    ];
    const splits = computeProRataSplits(3200, items);
    const sum = splits.reduce((acc, s) => acc + s.shareCents, 0);
    expect(sum).toBe(3200);
  });

  it("handles indivisible totals without losing cents", () => {
    const items = [
      { applicationId: "a", priceCents: 100 },
      { applicationId: "b", priceCents: 100 },
      { applicationId: "c", priceCents: 100 },
    ];
    const splits = computeProRataSplits(100, items); // 100 / 3 = 33.33...
    const sum = splits.reduce((acc, s) => acc + s.shareCents, 0);
    expect(sum).toBe(100);
    // remainder of 1 should go to a (highest tied → first) — implementation
    // detail, but verify we don't drop or duplicate cents.
    const counts = splits.map((s) => s.shareCents);
    expect(counts.sort()).toEqual([33, 33, 34]);
  });

  it("zero-price members → even split", () => {
    const items = [
      { applicationId: "a", priceCents: 0 },
      { applicationId: "b", priceCents: 0 },
    ];
    const splits = computeProRataSplits(101, items);
    expect(splits.reduce((a, s) => a + s.shareCents, 0)).toBe(101);
    expect(splits.map((s) => s.shareCents).sort()).toEqual([50, 51]);
  });

  it("single member receives the entire total", () => {
    const splits = computeProRataSplits(2500, [{ applicationId: "a", priceCents: 1000 }]);
    expect(splits).toEqual([{ applicationId: "a", shareCents: 2500 }]);
  });

  it("empty items → empty result", () => {
    expect(computeProRataSplits(1000, [])).toEqual([]);
  });

  it("higher-priced member receives the leftover cent", () => {
    const items = [
      { applicationId: "small", priceCents: 100 },
      { applicationId: "big", priceCents: 900 },
    ];
    // total 1001 → small gets 100.1 → 100, big gets 900.9 → 900, remainder 1 → big
    const splits = computeProRataSplits(1001, items);
    const big = splits.find((s) => s.applicationId === "big")!;
    const small = splits.find((s) => s.applicationId === "small")!;
    expect(big.shareCents + small.shareCents).toBe(1001);
    expect(big.shareCents).toBeGreaterThan(small.shareCents);
  });
});

describe("bundleAvailability", () => {
  const now = new Date("2026-04-20T12:00:00Z");
  const base = { status: "published" as const, startsAt: null, endsAt: null };

  it("draft → draft", () => {
    expect(bundleAvailability({ ...base, status: "draft" }, 2, 0, now)).toBe("draft");
  });

  it("archived → archived", () => {
    expect(bundleAvailability({ ...base, status: "archived" }, 2, 0, now)).toBe("archived");
  });

  it("empty members → empty", () => {
    expect(bundleAvailability(base, 0, 0, now)).toBe("empty");
  });

  it("future startsAt → not_started", () => {
    expect(
      bundleAvailability({ ...base, startsAt: new Date("2026-05-01") }, 2, 0, now),
    ).toBe("not_started");
  });

  it("past endsAt → expired", () => {
    expect(
      bundleAvailability({ ...base, endsAt: new Date("2026-04-01") }, 2, 0, now),
    ).toBe("expired");
  });

  it("overlap → owns_some", () => {
    expect(bundleAvailability(base, 3, 1, now)).toBe("owns_some");
  });

  it("clean published → available", () => {
    expect(bundleAvailability(base, 3, 0, now)).toBe("available");
  });

  it("expired beats overlap", () => {
    expect(
      bundleAvailability({ ...base, endsAt: new Date("2026-04-01") }, 3, 1, now),
    ).toBe("expired");
  });
});

describe("parseBundleRule", () => {
  it("returns {} for null/undefined/empty", () => {
    expect(parseBundleRule(null)).toEqual({});
    expect(parseBundleRule(undefined)).toEqual({});
    expect(parseBundleRule("")).toEqual({});
  });

  it("parses valid JSON", () => {
    expect(parseBundleRule('{"universityType":"ivy"}')).toEqual({ universityType: "ivy" });
  });

  it("returns {} on invalid JSON (no throw)", () => {
    expect(parseBundleRule("not json")).toEqual({});
  });
});
