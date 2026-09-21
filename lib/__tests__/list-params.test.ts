import { describe, it, expect } from "vitest";
import {
  MAX_PAGE,
  MAX_YEAR_FILTERS,
  MIN_ADMIT_YEAR,
  parsePage,
  parseSort,
  parseYearList,
} from "@/lib/list-params";

describe("parsePage", () => {
  it("parses a normal page number", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(" 7 ")).toBe(7);
  });

  it("falls back to page 1 for missing or junk input", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("NaN")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
  });

  it("clamps absurd page numbers instead of producing a huge OFFSET", () => {
    expect(parsePage("999999")).toBe(MAX_PAGE);
    expect(parsePage("1e999")).toBe(1); // parseInt stops at "1"
    expect(parsePage("50", 10)).toBe(10);
  });

  it("never returns NaN", () => {
    for (const raw of [undefined, "", "abc", "-1", "0", "1e999", "  "]) {
      expect(Number.isNaN(parsePage(raw))).toBe(false);
    }
  });
});

describe("parseYearList", () => {
  it("parses, sorts and de-duplicates", () => {
    expect(parseYearList("2024,2022,2024")).toEqual([2022, 2024]);
  });

  it("returns an empty list when absent or empty", () => {
    expect(parseYearList(undefined)).toEqual([]);
    expect(parseYearList("")).toEqual([]);
    expect(parseYearList(",,")).toEqual([]);
  });

  it("drops junk and out-of-range years but keeps the good ones", () => {
    expect(parseYearList("2023,abc,1200,2024")).toEqual([2023, 2024]);
    expect(parseYearList(String(MIN_ADMIT_YEAR - 1))).toEqual([]);
  });

  it("accepts next year (early admits) but not further out", () => {
    const next = new Date().getUTCFullYear() + 1;
    expect(parseYearList(String(next))).toEqual([next]);
    expect(parseYearList(String(next + 1))).toEqual([]);
  });

  it("caps how many years reach the IN clause", () => {
    const many = Array.from({ length: 40 }, (_, i) => 2000 + i).join(",");
    expect(parseYearList(many, 2100)).toHaveLength(MAX_YEAR_FILTERS);
  });
});

describe("parseSort", () => {
  const allowed = ["newest", "popular", "price_asc"] as const;

  it("passes through an allowed key", () => {
    expect(parseSort("popular", allowed, "newest")).toBe("popular");
  });

  it("falls back for anything else", () => {
    expect(parseSort(undefined, allowed, "newest")).toBe("newest");
    expect(parseSort("", allowed, "newest")).toBe("newest");
    expect(parseSort("price_asc; drop table", allowed, "newest")).toBe("newest");
    expect(parseSort("__proto__", allowed, "newest")).toBe("newest");
  });
});
