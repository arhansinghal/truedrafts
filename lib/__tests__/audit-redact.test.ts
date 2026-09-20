import { describe, it, expect } from "vitest";
import {
  MAX_VALUE_LENGTH,
  REDACTED,
  diff,
  diffRedacted,
  formatValue,
  isSensitiveKey,
  pick,
  redact,
  sameValue,
  summarizeChanges,
} from "../audit/redact";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
} from "../audit/query";

describe("isSensitiveKey", () => {
  it("matches the obvious secrets", () => {
    expect(isSensitiveKey("password")).toBe(true);
    expect(isSensitiveKey("passphrase")).toBe(true);
    expect(isSensitiveKey("apiKey")).toBe(true);
    expect(isSensitiveKey("api_key")).toBe(true);
    expect(isSensitiveKey("accessToken")).toBe(true);
    expect(isSensitiveKey("razorpay_signature")).toBe(true);
  });

  it("matches this codebase's payout fields whatever the casing", () => {
    expect(isSensitiveKey("bankAccountNumberEncrypted")).toBe(true);
    expect(isSensitiveKey("bank_account_number")).toBe(true);
    expect(isSensitiveKey("ACCOUNTNUMBER")).toBe(true);
    expect(isSensitiveKey("bankIfsc")).toBe(true);
    expect(isSensitiveKey("upiId")).toBe(true);
    expect(isSensitiveKey("zelleEmail")).toBe(true);
  });

  it("leaves ordinary fields alone", () => {
    expect(isSensitiveKey("status")).toBe(false);
    expect(isSensitiveKey("priceCents")).toBe(false);
    expect(isSensitiveKey("title")).toBe(false);
    expect(isSensitiveKey("createdAt")).toBe(false);
  });
});

describe("redact", () => {
  it("passes primitives through", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(null);
  });

  it("replaces sensitive values without dropping the key", () => {
    const out = redact({ id: "u1", password: "hunter2", role: "admin" }) as Record<
      string,
      unknown
    >;
    expect(out.id).toBe("u1");
    expect(out.role).toBe("admin");
    expect(out.password).toBe(REDACTED);
  });

  it("redacts nested sensitive values", () => {
    const out = redact({
      method: { kind: "bank", bankAccountNumberEncrypted: "aes:xyz", bankIfsc: "HDFC0001" },
    }) as { method: Record<string, unknown> };
    expect(out.method.kind).toBe("bank");
    expect(out.method.bankAccountNumberEncrypted).toBe(REDACTED);
    expect(out.method.bankIfsc).toBe(REDACTED);
  });

  it("serialises dates as ISO strings", () => {
    expect(redact(new Date("2026-09-19T12:00:00.000Z"))).toBe(
      "2026-09-19T12:00:00.000Z",
    );
  });

  it("survives an invalid date", () => {
    expect(redact(new Date("nope"))).toBe(null);
  });

  it("stringifies a non-finite number rather than emitting invalid JSON", () => {
    expect(redact(Number.POSITIVE_INFINITY)).toBe("Infinity");
    expect(redact(Number.NaN)).toBe("NaN");
  });

  it("truncates a very long string", () => {
    const out = redact("x".repeat(MAX_VALUE_LENGTH + 100)) as string;
    expect(out.length).toBeLessThan(MAX_VALUE_LENGTH + 40);
    expect(out).toContain("chars)");
  });

  it("bounds a long array and says how much it dropped", () => {
    const out = redact(Array.from({ length: 100 }, (_, i) => i)) as unknown[];
    expect(out.length).toBe(26);
    expect(String(out[25])).toContain("75 more");
  });

  it("stops descending past the depth cap instead of recursing forever", () => {
    let deep: Record<string, unknown> = { value: 1 };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => redact(deep)).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain("depth limit");
  });

  it("drops functions rather than emitting null-shaped noise", () => {
    const out = redact({ id: "x", fn: () => 1 }) as Record<string, unknown>;
    expect(out.id).toBe("x");
    expect("fn" in out).toBe(false);
  });

  it("produces something JSON.stringify accepts", () => {
    const out = redact({
      when: new Date("2026-01-01T00:00:00.000Z"),
      token: "secret",
      tags: ["a", "b"],
      nested: { n: 1 },
    });
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe("sameValue", () => {
  it("compares primitives", () => {
    expect(sameValue(1, 1)).toBe(true);
    expect(sameValue("a", "a")).toBe(true);
    expect(sameValue(1, 2)).toBe(false);
    expect(sameValue(null, null)).toBe(true);
  });

  it("does not equate a value with a differently typed one", () => {
    expect(sameValue(1, "1")).toBe(false);
    expect(sameValue(null, {})).toBe(false);
    expect(sameValue([], {})).toBe(false);
  });

  it("compares arrays element-wise and order-sensitively", () => {
    expect(sameValue([1, 2], [1, 2])).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
    expect(sameValue([1], [1, 2])).toBe(false);
  });

  it("compares objects by key union", () => {
    expect(sameValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(sameValue({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameValue({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(sameValue({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });

  it("treats a missing key and an explicit null as the same", () => {
    expect(sameValue({ a: 1 }, { a: 1, b: null })).toBe(true);
  });
});

describe("diffRedacted", () => {
  it("reports nothing when nothing moved", () => {
    expect(diffRedacted({ status: "pending" }, { status: "pending" })).toEqual([]);
  });

  it("reports a single changed field", () => {
    const changes = diffRedacted(
      { status: "pending" },
      { status: "approved" },
    );
    expect(changes).toEqual([
      { path: "status", before: "pending", after: "approved" },
    ]);
  });

  it("only reports the fields that actually changed", () => {
    const changes = diffRedacted(
      { status: "pending", priceCents: 50_000, title: "Stanford" },
      { status: "approved", priceCents: 50_000, title: "Stanford" },
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe("status");
  });

  it("walks into nested objects and uses dotted paths", () => {
    const changes = diffRedacted(
      { snapshot: { kind: "bank", holder: "A" } },
      { snapshot: { kind: "upi", holder: "A" } },
    );
    expect(changes).toEqual([
      { path: "snapshot.kind", before: "bank", after: "upi" },
    ]);
  });

  it("treats an added key as a change from null", () => {
    const changes = diffRedacted({}, { note: "spam" });
    expect(changes).toEqual([{ path: "note", before: null, after: "spam" }]);
  });

  it("treats a removed key as a change to null", () => {
    const changes = diffRedacted({ note: "spam" }, {});
    expect(changes).toEqual([{ path: "note", before: "spam", after: null }]);
  });

  it("orders paths deterministically", () => {
    const changes = diffRedacted(
      { zebra: 1, apple: 1, mango: 1 },
      { zebra: 2, apple: 2, mango: 2 },
    );
    expect(changes.map((c) => c.path)).toEqual(["apple", "mango", "zebra"]);
  });

  it("compares an array as one value rather than per index", () => {
    const changes = diffRedacted({ tags: ["a"] }, { tags: ["a", "b"] });
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toBe("tags");
  });

  it("handles a snapshot that is entirely absent on one side", () => {
    const changes = diffRedacted(null, { status: "approved" });
    expect(changes).toHaveLength(1);
    expect(changes[0].before).toBe(null);
  });
});

describe("diff", () => {
  it("redacts before comparing, so a secret never reaches the log", () => {
    const changes = diff(
      { role: "reader", password: "old-secret" },
      { role: "admin", password: "new-secret" },
    );
    const serialized = JSON.stringify(changes);
    expect(serialized).not.toContain("old-secret");
    expect(serialized).not.toContain("new-secret");
    // Both sides redact to the same placeholder, so the field reads as unchanged.
    expect(changes.map((c) => c.path)).toEqual(["role"]);
  });

  it("normalises dates so an identical instant is not a change", () => {
    const changes = diff(
      { at: new Date("2026-09-19T12:00:00.000Z") },
      { at: new Date("2026-09-19T12:00:00.000Z") },
    );
    expect(changes).toEqual([]);
  });
});

describe("formatValue", () => {
  it("renders each kind readably", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue("")).toBe('""');
    expect(formatValue("pending")).toBe("pending");
    expect(formatValue(true)).toBe("true");
    expect(formatValue(42)).toBe("42");
    expect(formatValue([])).toBe("[]");
    expect(formatValue(["a", "b"])).toBe("a, b");
    expect(formatValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("summarizeChanges", () => {
  const change = (path: string) => ({ path, before: 1, after: 2 });

  it("says so when nothing changed", () => {
    expect(summarizeChanges([])).toBe("No field changes recorded");
  });

  it("names up to three fields", () => {
    expect(summarizeChanges([change("a"), change("b")])).toBe("a, b");
    expect(summarizeChanges([change("a"), change("b"), change("c")])).toBe(
      "a, b, c",
    );
  });

  it("counts the rest beyond three", () => {
    expect(
      summarizeChanges([change("a"), change("b"), change("c"), change("d"), change("e")]),
    ).toBe("a, b, c +2 more");
  });
});

describe("pick", () => {
  it("keeps only the named keys", () => {
    const out = pick({ a: 1, b: 2, c: 3 }, ["a", "c"]);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it("passes a missing source straight through as null", () => {
    type Row = { a: number };
    expect(pick<Row, "a">(null, ["a"])).toBe(null);
    expect(pick<Row, "a">(undefined, ["a"])).toBe(null);
  });
});

describe("pagination bounds", () => {
  it("defaults and clamps the page size", () => {
    expect(normalizePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize("not a number")).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(0)).toBe(1);
    expect(normalizePageSize(-10)).toBe(1);
    expect(normalizePageSize(25)).toBe(25);
    expect(normalizePageSize(10_000)).toBe(MAX_PAGE_SIZE);
    expect(normalizePageSize(25.9)).toBe(25);
  });

  it("defaults and floors the page number", () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage("x")).toBe(1);
    expect(normalizePage(0)).toBe(1);
    expect(normalizePage(-3)).toBe(1);
    expect(normalizePage(4)).toBe(4);
    expect(normalizePage(4.7)).toBe(4);
  });
});
