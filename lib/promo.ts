/**
 * Promo code evaluation.
 *
 * Pure functions only — no database, no clock reads that aren't passed in. The
 * store layer (`lib/promo-store.ts`) does the I/O and calls into here, which
 * keeps every rule about who may use a code, for how much, and when, testable
 * in isolation.
 *
 * Money is INR paise, matching the rest of the codebase.
 */

/** What the platform keeps on a full-price sale. Mirrors lib/payments.ts. */
const PLATFORM_FEE_PCT = 0.5;

export type PromoKind = "percent" | "flat";
export type PromoScope = "all" | "applications" | "essays" | "bundles";

/** The subset of a promo_codes row the rules actually need. */
export type PromoTerms = {
  id: string;
  code: string;
  kind: PromoKind;
  percentOff: number | null;
  flatOffCents: number | null;
  maxDiscountCents: number | null;
  minSubtotalCents: number;
  scope: PromoScope;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  timesRedeemed: number;
  startsAt: Date | null;
  endsAt: Date | null;
  active: boolean;
};

export type PromoContext = {
  now: Date;
  subtotalCents: number;
  /** What the buyer is checking out. */
  listingKind: "essay" | "application" | "bundle";
  /** How many times this buyer has already used this specific code. */
  redemptionsByThisUser: number;
};

export type PromoRejection =
  | "unknown_code"
  | "inactive"
  | "not_started"
  | "expired"
  | "wrong_scope"
  | "below_minimum"
  | "code_exhausted"
  | "user_limit_reached";

export type PromoCheck =
  | { ok: true }
  | { ok: false; reason: PromoRejection; message: string };

const REJECTION_MESSAGES: Record<PromoRejection, string> = {
  unknown_code: "That code doesn't exist.",
  inactive: "That code is no longer available.",
  not_started: "That code isn't active yet.",
  expired: "That code has expired.",
  wrong_scope: "That code doesn't apply to this purchase.",
  below_minimum: "Your order isn't large enough for this code.",
  code_exhausted: "That code has been fully claimed.",
  user_limit_reached: "You've already used that code.",
};

function reject(reason: PromoRejection): PromoCheck {
  return { ok: false, reason, message: REJECTION_MESSAGES[reason] };
}

/**
 * Canonical form of a code as typed by a buyer.
 *
 * Codes are stored upper-case, so everything that touches user input runs
 * through here first. Internal whitespace is stripped too — people paste
 * "WELCOME 10" out of emails more often than you'd think.
 */
export function normalizeCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Whether a code's scope admits this kind of listing. */
export function scopeAdmits(
  scope: PromoScope,
  listingKind: PromoContext["listingKind"],
): boolean {
  if (scope === "all") return true;
  if (scope === "applications") return listingKind === "application";
  if (scope === "essays") return listingKind === "essay";
  return listingKind === "bundle";
}

/**
 * Every rule that decides whether a code may be used right now, in order of how
 * useful the resulting message is to the buyer.
 */
export function checkPromo(terms: PromoTerms, ctx: PromoContext): PromoCheck {
  if (!terms.active) return reject("inactive");

  if (terms.startsAt && ctx.now.getTime() < terms.startsAt.getTime()) {
    return reject("not_started");
  }
  if (terms.endsAt && ctx.now.getTime() > terms.endsAt.getTime()) {
    return reject("expired");
  }

  if (!scopeAdmits(terms.scope, ctx.listingKind)) {
    return reject("wrong_scope");
  }

  if (ctx.subtotalCents < terms.minSubtotalCents) {
    return reject("below_minimum");
  }

  if (
    terms.maxRedemptions !== null &&
    terms.timesRedeemed >= terms.maxRedemptions
  ) {
    return reject("code_exhausted");
  }

  if (ctx.redemptionsByThisUser >= terms.maxRedemptionsPerUser) {
    return reject("user_limit_reached");
  }

  return { ok: true };
}

export type PromoQuote = {
  subtotalCents: number;
  discountCents: number;
  chargedCents: number;
};

/**
 * What the buyer actually pays with this code applied.
 *
 * The discount can never exceed the subtotal (no negative charges, no credit
 * balances) and never goes below zero.
 */
export function quotePromo(
  terms: PromoTerms,
  subtotalCents: number,
): PromoQuote {
  let discountCents =
    terms.kind === "percent"
      ? Math.round((subtotalCents * (terms.percentOff ?? 0)) / 100)
      : (terms.flatOffCents ?? 0);

  // A percent code can carry a cap so a "40% off" campaign on an unusually
  // expensive listing doesn't blow through the budget in one sale.
  if (terms.kind === "percent") {
    discountCents = Math.min(discountCents, terms.maxDiscountCents ?? 0);
  }

  discountCents = Math.max(0, Math.min(discountCents, subtotalCents));

  return {
    subtotalCents,
    discountCents,
    chargedCents: subtotalCents - discountCents,
  };
}

export type RevenueSplit = {
  /** What the platform keeps. */
  feeCents: number;
  /** What the writer is credited. */
  payoutCents: number;
};

/**
 * Split a discounted sale between the platform and the writer.
 *
 * Policy decision: **writers are made whole on the list price.** A writer who
 * priced their application at ₹500 earns the same ₹250 whether or not the buyer
 * found a coupon — the discount comes out of the platform's half, not theirs.
 * Otherwise a marketing campaign would quietly tax the people whose work it is
 * promoting, and writers would have no way to opt out.
 */
export function splitWithPromo(input: {
  chargedCents: number;
  listPriceCents: number;
}): RevenueSplit {
  const { chargedCents, listPriceCents } = input;

  const payoutCents =
    listPriceCents - Math.floor(listPriceCents * PLATFORM_FEE_PCT);
  const feeCents = chargedCents - payoutCents;

  return { feeCents, payoutCents };
}

/** The undiscounted split, for sales with no code attached. */
export function splitWithoutPromo(amountCents: number): RevenueSplit {
  const feeCents = Math.floor(amountCents * PLATFORM_FEE_PCT);
  return { feeCents, payoutCents: amountCents - feeCents };
}

/** Short human summary of a code's terms, for the admin table and receipts. */
export function describeTerms(terms: PromoTerms): string {
  const base =
    terms.kind === "percent"
      ? `${terms.percentOff ?? 0}% off`
      : `₹${((terms.flatOffCents ?? 0) / 100).toLocaleString("en-IN")} off`;

  const bits: string[] = [base];
  if (terms.kind === "percent" && terms.maxDiscountCents !== null) {
    bits.push(`up to ₹${(terms.maxDiscountCents / 100).toLocaleString("en-IN")}`);
  }
  if (terms.minSubtotalCents > 0) {
    bits.push(
      `on orders over ₹${(terms.minSubtotalCents / 100).toLocaleString("en-IN")}`,
    );
  }
  if (terms.scope !== "all") bits.push(`${terms.scope} only`);
  return bits.join(", ");
}

/**
 * Validation for the admin create/edit form. Returns a list of human problems;
 * an empty list means the payload is sound.
 */
export function validateTermsInput(input: {
  code?: unknown;
  kind?: unknown;
  percentOff?: unknown;
  flatOffCents?: unknown;
  maxDiscountCents?: unknown;
  minSubtotalCents?: unknown;
  maxRedemptions?: unknown;
  maxRedemptionsPerUser?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
}): string[] {
  const problems: string[] = [];

  const code = typeof input.code === "string" ? normalizeCode(input.code) : "";
  if (code.length < 3) problems.push("Code must be at least 3 characters.");
  if (code.length > 32) problems.push("Code must be 32 characters or fewer.");
  if (code && !/^[A-Z0-9_-]+$/.test(code)) {
    problems.push("Code may only contain letters, numbers, hyphens and underscores.");
  }

  if (input.kind !== "percent" && input.kind !== "flat") {
    problems.push("Pick a discount type.");
  }

  if (input.kind === "percent") {
    const p = Number(input.percentOff);
    if (!Number.isInteger(p) || p < 1 || p > 100) {
      problems.push("Percentage must be a whole number between 1 and 100.");
    }
  }

  if (input.kind === "flat") {
    const f = Number(input.flatOffCents);
    if (!Number.isInteger(f) || f < 1) {
      problems.push("Flat discount must be a positive amount.");
    }
  }

  for (const [label, value] of [
    ["Maximum discount", input.maxDiscountCents],
    ["Minimum subtotal", input.minSubtotalCents],
    ["Total redemptions", input.maxRedemptions],
  ] as const) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      problems.push(`${label} must be a whole number of zero or more.`);
    }
  }

  const perUser = Number(input.maxRedemptionsPerUser ?? 1);
  if (!Number.isInteger(perUser) || perUser < 1) {
    problems.push("Per-buyer limit must be at least 1.");
  }

  const startsAt = input.startsAt ? new Date(String(input.startsAt)) : null;
  const endsAt = input.endsAt ? new Date(String(input.endsAt)) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) {
    problems.push("Start date is not a valid date.");
  }
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    problems.push("End date is not a valid date.");
  }
  if (
    startsAt &&
    endsAt &&
    !Number.isNaN(startsAt.getTime()) &&
    !Number.isNaN(endsAt.getTime()) &&
    endsAt.getTime() <= startsAt.getTime()
  ) {
    problems.push("End date must be after the start date.");
  }

  return problems;
}
