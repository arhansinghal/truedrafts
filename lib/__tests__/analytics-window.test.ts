import { describe, it, expect } from "vitest";
import {
  bucketKey,
  bucketLabel,
  enumerateBuckets,
  endOfDayUTC,
  granularityFor,
  parseRangeKey,
  previousWindow,
  startOfDayUTC,
  startOfMonthUTC,
  startOfWeekUTC,
  windowFor,
  ymdUTC,
  ymUTC,
} from "../analytics/window";

const NOW = new Date("2026-09-19T14:32:11.000Z");

describe("parseRangeKey", () => {
  it("accepts the four supported ranges", () => {
    expect(parseRangeKey("7d")).toBe("7d");
    expect(parseRangeKey("30d")).toBe("30d");
    expect(parseRangeKey("90d")).toBe("90d");
    expect(parseRangeKey("12m")).toBe("12m");
  });

  it("falls back to 30d for anything else", () => {
    expect(parseRangeKey(null)).toBe("30d");
    expect(parseRangeKey(undefined)).toBe("30d");
    expect(parseRangeKey("")).toBe("30d");
    expect(parseRangeKey("all-time")).toBe("30d");
    expect(parseRangeKey("../../etc/passwd")).toBe("30d");
  });
});

describe("day/week/month boundaries", () => {
  it("startOfDayUTC snaps to midnight UTC", () => {
    expect(startOfDayUTC(NOW).toISOString()).toBe("2026-09-19T00:00:00.000Z");
  });

  it("endOfDayUTC snaps to the last millisecond", () => {
    expect(endOfDayUTC(NOW).toISOString()).toBe("2026-09-19T23:59:59.999Z");
  });

  it("startOfWeekUTC snaps back to Monday", () => {
    // 2026-09-19 is a Saturday; its Monday is the 14th.
    expect(ymdUTC(startOfWeekUTC(NOW))).toBe("2026-09-14");
  });

  it("startOfWeekUTC treats Sunday as the end of its week, not the start", () => {
    const sunday = new Date("2026-09-20T06:00:00.000Z");
    expect(ymdUTC(startOfWeekUTC(sunday))).toBe("2026-09-14");
  });

  it("startOfMonthUTC snaps to the first", () => {
    expect(startOfMonthUTC(NOW).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("windowFor", () => {
  it("7d covers seven whole days ending today", () => {
    const w = windowFor("7d", NOW);
    expect(w.start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-09-19T23:59:59.999Z");
    expect(enumerateBuckets(w)).toHaveLength(7);
  });

  it("30d covers thirty whole days", () => {
    const w = windowFor("30d", NOW);
    expect(w.start.toISOString()).toBe("2026-08-21T00:00:00.000Z");
    expect(enumerateBuckets(w)).toHaveLength(30);
  });

  it("picks a granularity that keeps the bucket count readable", () => {
    expect(granularityFor("7d")).toBe("day");
    expect(granularityFor("30d")).toBe("day");
    expect(granularityFor("90d")).toBe("week");
    expect(granularityFor("12m")).toBe("month");
  });
});

describe("previousWindow", () => {
  it("does not overlap the current window", () => {
    const w = windowFor("30d", NOW);
    const prev = previousWindow(w);
    expect(prev.end.getTime()).toBeLessThan(w.start.getTime());
  });

  it("is the same length as the current window", () => {
    const w = windowFor("7d", NOW);
    const prev = previousWindow(w);
    const span = (x: { start: Date; end: Date }) =>
      x.end.getTime() - x.start.getTime();
    expect(span(prev)).toBe(span(w));
  });

  it("sits immediately before the current window", () => {
    const w = windowFor("7d", NOW);
    const prev = previousWindow(w);
    expect(w.start.getTime() - prev.end.getTime()).toBe(1);
    expect(ymdUTC(prev.start)).toBe("2026-09-06");
  });
});

describe("bucketKey", () => {
  it("keys days by their own date", () => {
    expect(bucketKey(NOW, "day")).toBe("2026-09-19");
  });

  it("keys weeks by their Monday", () => {
    expect(bucketKey(NOW, "week")).toBe("2026-09-14");
  });

  it("keys months as YYYY-MM", () => {
    expect(bucketKey(NOW, "month")).toBe("2026-09");
  });

  it("uses UTC, not the host timezone", () => {
    // 00:30 UTC is still the previous evening in the Americas. The key must not
    // move with the machine running the code.
    const justAfterMidnight = new Date("2026-09-19T00:30:00.000Z");
    expect(bucketKey(justAfterMidnight, "day")).toBe("2026-09-19");
    expect(ymUTC(justAfterMidnight)).toBe("2026-09");
  });
});

describe("enumerateBuckets", () => {
  it("returns ordered, gapless day keys", () => {
    const keys = enumerateBuckets(windowFor("7d", NOW));
    expect(keys[0]).toBe("2026-09-13");
    expect(keys[keys.length - 1]).toBe("2026-09-19");
    expect(keys).toEqual([...keys].sort());
  });

  it("returns one key per week for a 90 day window", () => {
    const keys = enumerateBuckets(windowFor("90d", NOW));
    expect(new Set(keys).size).toBe(keys.length);
    // 90 days spans 13 or 14 Mondays depending on where the window lands.
    expect(keys.length).toBeGreaterThanOrEqual(13);
    expect(keys.length).toBeLessThanOrEqual(14);
  });

  it("returns twelve or thirteen month keys for a 12m window", () => {
    const keys = enumerateBuckets(windowFor("12m", NOW));
    expect(keys.length).toBeGreaterThanOrEqual(12);
    expect(keys.length).toBeLessThanOrEqual(13);
    expect(keys[keys.length - 1]).toBe("2026-09");
  });
});

describe("bucketLabel", () => {
  // ICU abbreviates September as "Sep" or "Sept" depending on the bundled
  // locale data, so match loosely on the month rather than pinning the string.
  it("renders a day key in UTC regardless of host timezone", () => {
    expect(bucketLabel("2026-09-19", "day")).toMatch(/^19 Sept?$/);
  });

  it("renders a month key with its year", () => {
    expect(bucketLabel("2026-09", "month")).toMatch(/^Sept? 2026$/);
  });

  it("passes through anything it cannot parse", () => {
    expect(bucketLabel("not-a-date", "day")).toBe("not-a-date");
  });
});
