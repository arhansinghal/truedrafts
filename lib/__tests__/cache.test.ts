import { describe, it, expect } from "vitest";
import { cacheGet, cacheKey, cacheSet } from "../studio/cache";

describe("studio cache", () => {
  it("normalizes case and whitespace in keys", () => {
    const k1 = cacheKey("app1", "I want to research Stanford.", false);
    const k2 = cacheKey("app1", "  i  WANT to research stanford. ", false);
    expect(k1).toBe(k2);
  });

  it("differentiates web vs hub-only", () => {
    const k1 = cacheKey("app1", "x", false);
    const k2 = cacheKey("app1", "x", true);
    expect(k1).not.toBe(k2);
  });

  it("get returns null for missing keys", () => {
    expect(cacheGet("nope::nope")).toBeNull();
  });

  it("set then get round-trips a value", () => {
    const k = cacheKey("app1", "anything", false);
    cacheSet(k, { hello: "world" });
    expect(cacheGet<{ hello: string }>(k)).toEqual({ hello: "world" });
  });
});
