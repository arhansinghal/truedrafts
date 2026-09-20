import { describe, it, expect } from "vitest";
import {
  checkPromo,
  describeTerms,
  normalizeCode,
  quotePromo,
  scopeAdmits,
  splitWithPromo,
  splitWithoutPromo,
  validateTermsInput,
  type PromoContext,
  type PromoTerms,
} from "../promo";

const NOW = new Date("2026-09-19T12:00:00.000Z");

/** A sane, permissive code. Individual tests override what they care about. */
function makeTerms(overrides: Partial<PromoTerms> = {}): PromoTerms {
  return {
    id: "promo-1",
    code: "WELCOME10",
    kind: "percent",
    percentOff: 10,
    flatOffCents: null,
    maxDiscountCents: 1_000_000,
    minSubtotalCents: 0,
    scope: "all",
    maxRedemptions: null,
    maxRedemptionsPerUser: 1,
    timesRedeemed: 0,
    startsAt: null,
    endsAt: null,
    active: true,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<PromoContext> = {}): PromoContext {
  return {
    now: NOW,
    subtotalCents: 50_000,
    listingKind: "application",
    redemptionsByThisUser: 0,
    ...overrides,
  };
}

describe("normalizeCode", () => {
  it("upper-cases and strips whitespace", () => {
    expect(normalizeCode("welcome10")).toBe("WELCOME10");
    expect(normalizeCode("  welcome10  ")).toBe("WELCOME10");
    expect(normalizeCode("WELCOME 10")).toBe("WELCOME10");
    expect(normalizeCode("wel\tcome\n10")).toBe("WELCOME10");
  });

  it("leaves an empty string empty", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });
});

describe("scopeAdmits", () => {
  it("lets 'all' through for everything", () => {
    expect(scopeAdmits("all", "essay")).toBe(true);
    expect(scopeAdmits("all", "application")).toBe(true);
    expect(scopeAdmits("all", "bundle")).toBe(true);
  });

  it("matches each narrow scope to exactly one listing kind", () => {
    expect(scopeAdmits("applications", "application")).toBe(true);
    expect(scopeAdmits("applications", "essay")).toBe(false);
    expect(scopeAdmits("essays", "essay")).toBe(true);
    expect(scopeAdmits("essays", "bundle")).toBe(false);
    expect(scopeAdmits("bundles", "bundle")).toBe(true);
    expect(scopeAdmits("bundles", "application")).toBe(false);
  });
});

describe("checkPromo", () => {
  it("accepts a plain, live code", () => {
    expect(checkPromo(makeTerms(), makeCtx())).toEqual({ ok: true });
  });

  it("rejects a paused code", () => {
    const check = checkPromo(makeTerms({ active: false }), makeCtx());
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("inactive");
  });

  it("rejects a code whose window hasn't opened", () => {
    const check = checkPromo(
      makeTerms({ startsAt: new Date("2026-10-01T00:00:00.000Z") }),
      makeCtx(),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("not_started");
  });

  it("rejects a code whose window has closed", () => {
    const check = checkPromo(
      makeTerms({ endsAt: new Date("2026-09-01T00:00:00.000Z") }),
      makeCtx(),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("expired");
  });

  it("accepts a code on the last instant of its window", () => {
    const endsAt = new Date(NOW.getTime());
    expect(checkPromo(makeTerms({ endsAt }), makeCtx())).toEqual({ ok: true });
  });

  it("rejects a code that doesn't cover this listing kind", () => {
    const check = checkPromo(
      makeTerms({ scope: "bundles" }),
      makeCtx({ listingKind: "application" }),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("wrong_scope");
  });

  it("enforces the minimum subtotal", () => {
    const terms = makeTerms({ minSubtotalCents: 100_000 });
    const tooSmall = checkPromo(terms, makeCtx({ subtotalCents: 99_999 }));
    expect(tooSmall.ok).toBe(false);
    if (!tooSmall.ok) expect(tooSmall.reason).toBe("below_minimum");

    expect(checkPromo(terms, makeCtx({ subtotalCents: 100_000 }))).toEqual({
      ok: true,
    });
  });

  it("enforces the global redemption cap", () => {
    const check = checkPromo(
      makeTerms({ maxRedemptions: 100, timesRedeemed: 100 }),
      makeCtx(),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("code_exhausted");
  });

  it("treats a null cap as unlimited", () => {
    expect(
      checkPromo(
        makeTerms({ maxRedemptions: null, timesRedeemed: 99_999 }),
        makeCtx(),
      ),
    ).toEqual({ ok: true });
  });

  it("enforces the per-buyer cap", () => {
    const check = checkPromo(
      makeTerms({ maxRedemptionsPerUser: 1 }),
      makeCtx({ redemptionsByThisUser: 1 }),
    );
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("user_limit_reached");
  });

  it("allows a multi-use code up to its per-buyer cap", () => {
    const terms = makeTerms({ maxRedemptionsPerUser: 3 });
    expect(checkPromo(terms, makeCtx({ redemptionsByThisUser: 2 }))).toEqual({
      ok: true,
    });
    const over = checkPromo(terms, makeCtx({ redemptionsByThisUser: 3 }));
    expect(over.ok).toBe(false);
  });
});

describe("quotePromo", () => {
  it("takes a percentage off the subtotal", () => {
    const quote = quotePromo(makeTerms({ percentOff: 10 }), 50_000);
    expect(quote.discountCents).toBe(5_000);
    expect(quote.chargedCents).toBe(45_000);
  });

  it("rounds a percentage to the nearest paisa", () => {
    const quote = quotePromo(makeTerms({ percentOff: 33 }), 10_001);
    expect(quote.discountCents).toBe(3_300);
    expect(quote.subtotalCents - quote.discountCents).toBe(quote.chargedCents);
  });

  it("honours a cap on a percentage code", () => {
    const quote = quotePromo(
      makeTerms({ percentOff: 50, maxDiscountCents: 10_000 }),
      100_000,
    );
    expect(quote.discountCents).toBe(10_000);
    expect(quote.chargedCents).toBe(90_000);
  });

  it("takes a flat amount off", () => {
    const quote = quotePromo(
      makeTerms({ kind: "flat", percentOff: null, flatOffCents: 7_500 }),
      50_000,
    );
    expect(quote.discountCents).toBe(7_500);
    expect(quote.chargedCents).toBe(42_500);
  });

  it("never discounts past free", () => {
    const quote = quotePromo(
      makeTerms({ kind: "flat", percentOff: null, flatOffCents: 999_999 }),
      50_000,
    );
    expect(quote.discountCents).toBe(50_000);
    expect(quote.chargedCents).toBe(0);
  });

  it("never produces a negative discount", () => {
    const quote = quotePromo(
      makeTerms({ kind: "flat", percentOff: null, flatOffCents: -500 }),
      50_000,
    );
    expect(quote.discountCents).toBe(0);
    expect(quote.chargedCents).toBe(50_000);
  });
});

describe("revenue splits", () => {
  it("splits an undiscounted sale down the middle", () => {
    const split = splitWithoutPromo(50_000);
    expect(split.feeCents).toBe(25_000);
    expect(split.payoutCents).toBe(25_000);
    expect(split.feeCents + split.payoutCents).toBe(50_000);
  });

  it("handles an odd amount without losing a paisa", () => {
    const split = splitWithoutPromo(50_001);
    expect(split.feeCents + split.payoutCents).toBe(50_001);
  });

  it("keeps the writer whole on a discounted sale", () => {
    // 10% off a ₹500 listing: the writer still earns their ₹250.
    const split = splitWithPromo({ chargedCents: 45_000, listPriceCents: 50_000 });
    expect(split.payoutCents).toBe(25_000);
  });

  it("takes the discount out of the platform's half", () => {
    const full = splitWithoutPromo(50_000);
    const discounted = splitWithPromo({
      chargedCents: 45_000,
      listPriceCents: 50_000,
    });
    expect(discounted.payoutCents).toBe(full.payoutCents);
    expect(full.feeCents - discounted.feeCents).toBe(5_000);
  });

  it("still balances against what was actually charged", () => {
    const charged = 40_000;
    const split = splitWithPromo({ chargedCents: charged, listPriceCents: 50_000 });
    expect(split.feeCents + split.payoutCents).toBe(charged);
  });
});

describe("describeTerms", () => {
  it("describes a plain percentage code", () => {
    expect(
      describeTerms(makeTerms({ percentOff: 15, maxDiscountCents: null })),
    ).toBe("15% off");
  });

  it("mentions the cap and the minimum", () => {
    const text = describeTerms(
      makeTerms({
        percentOff: 20,
        maxDiscountCents: 20_000,
        minSubtotalCents: 50_000,
      }),
    );
    expect(text).toContain("20% off");
    expect(text).toContain("up to ₹200");
    expect(text).toContain("over ₹500");
  });

  it("mentions a narrow scope", () => {
    expect(describeTerms(makeTerms({ scope: "bundles" }))).toContain(
      "bundles only",
    );
  });
});

describe("validateTermsInput", () => {
  const good = {
    code: "LAUNCH20",
    kind: "percent",
    percentOff: 20,
    maxRedemptionsPerUser: 1,
  };

  it("accepts a sound payload", () => {
    expect(validateTermsInput(good)).toEqual([]);
  });

  it("rejects a short or malformed code", () => {
    expect(validateTermsInput({ ...good, code: "AB" }).length).toBeGreaterThan(0);
    expect(
      validateTermsInput({ ...good, code: "HELLO WORLD!" }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects an out-of-range percentage", () => {
    expect(validateTermsInput({ ...good, percentOff: 0 }).length).toBe(1);
    expect(validateTermsInput({ ...good, percentOff: 101 }).length).toBe(1);
    expect(validateTermsInput({ ...good, percentOff: 12.5 }).length).toBe(1);
  });

  it("requires a positive flat amount", () => {
    const problems = validateTermsInput({
      code: "FLAT",
      kind: "flat",
      flatOffCents: 0,
      maxRedemptionsPerUser: 1,
    });
    expect(problems.length).toBe(1);
  });

  it("rejects an end date at or before the start date", () => {
    const problems = validateTermsInput({
      ...good,
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-09-01T00:00:00.000Z",
    });
    expect(problems.some((p) => p.includes("after the start date"))).toBe(true);
  });

  it("accepts an absent optional field but rejects a negative one", () => {
    expect(validateTermsInput({ ...good, maxDiscountCents: "" })).toEqual([]);
    expect(validateTermsInput({ ...good, maxDiscountCents: null })).toEqual([]);
    expect(
      validateTermsInput({ ...good, maxDiscountCents: -1 }).length,
    ).toBeGreaterThan(0);
  });

  it("requires a per-buyer limit of at least one", () => {
    expect(
      validateTermsInput({ ...good, maxRedemptionsPerUser: 0 }).length,
    ).toBe(1);
  });
});
