/**
 * Database side of promo codes.
 *
 * The rules live in `lib/promo.ts`; this module does the lookups, reserves a
 * redemption when an order is created, and settles it when the payment is
 * granted.
 *
 * Lifecycle of a redemption row:
 *
 *   reserved ──► applied   payment granted (verify-payment or webhook)
 *        │
 *        └────► void       checkout abandoned / order expired
 *
 * Reserving rather than incrementing a counter at checkout time means an
 * abandoned Razorpay modal does not permanently eat one of a limited code's
 * uses, while still stopping the same buyer from opening ten tabs and using a
 * single-use code ten times.
 */

import { db } from "@/lib/db";
import { promoCodes, promoRedemptions } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

import {
  checkPromo,
  normalizeCode,
  quotePromo,
  type PromoCheck,
  type PromoContext,
  type PromoQuote,
  type PromoTerms,
} from "@/lib/promo";

type PromoRow = typeof promoCodes.$inferSelect;

/** Narrow a full row down to the terms the rules operate on. */
export function toTerms(row: PromoRow): PromoTerms {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    percentOff: row.percentOff,
    flatOffCents: row.flatOffCents,
    maxDiscountCents: row.maxDiscountCents,
    minSubtotalCents: row.minSubtotalCents,
    scope: row.scope,
    maxRedemptions: row.maxRedemptions,
    maxRedemptionsPerUser: row.maxRedemptionsPerUser,
    timesRedeemed: row.timesRedeemed,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    active: row.active,
  };
}

/** Look a code up by what the buyer typed. */
export async function findCode(raw: string): Promise<PromoRow | null> {
  const code = normalizeCode(raw);
  if (!code) return null;
  const row = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, code),
  });
  return row ?? null;
}

/** How many times this buyer has already committed to this code. */
async function redemptionsForBuyer(
  promoCodeId: string,
  buyerId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoRedemptions)
    .where(
      and(
        eq(promoRedemptions.promoCodeId, promoCodeId),
        eq(promoRedemptions.buyerId, buyerId),
        // "void" rows are abandoned checkouts and do not count against anyone.
        sql`${promoRedemptions.status} <> 'void'`,
      ),
    );
  return rows[0]?.count ?? 0;
}

/** How many times this code has been committed to across all buyers. */
async function redemptionsForCode(promoCodeId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoRedemptions)
    .where(
      and(
        eq(promoRedemptions.promoCodeId, promoCodeId),
        sql`${promoRedemptions.status} <> 'void'`,
      ),
    );
  return rows[0]?.count ?? 0;
}

export type PromoEvaluation =
  | { ok: true; terms: PromoTerms; quote: PromoQuote }
  | { ok: false; reason: string; message: string };

/**
 * Evaluate a code for a buyer without committing anything. Used by the
 * "apply code" box at checkout so the buyer sees the new total before paying.
 */
export async function evaluateCode(input: {
  raw: string;
  buyerId: string;
  subtotalCents: number;
  listingKind: PromoContext["listingKind"];
  now?: Date;
}): Promise<PromoEvaluation> {
  const row = await findCode(input.raw);
  if (!row) {
    return {
      ok: false,
      reason: "unknown_code",
      message: "That code doesn't exist.",
    };
  }

  const terms = toTerms(row);
  const redemptionsByThisUser = await redemptionsForBuyer(
    terms.id,
    input.buyerId,
  );

  const verdict: PromoCheck = checkPromo(terms, {
    now: input.now ?? new Date(),
    subtotalCents: input.subtotalCents,
    listingKind: input.listingKind,
    redemptionsByThisUser,
  });

  if (!verdict.ok) {
    return { ok: false, reason: verdict.reason, message: verdict.message };
  }

  return { ok: true, terms, quote: quotePromo(terms, input.subtotalCents) };
}

export type ReserveResult =
  | { ok: true; quote: PromoQuote; redemptionId: string }
  | { ok: false; reason: string; message: string };

/**
 * Commit a buyer to a code for a specific Razorpay order.
 *
 * Called immediately after the order is created, so the discount the buyer was
 * quoted is the discount the grant path will honour — the client never gets to
 * tell the server what the discount was.
 */
export async function reserveRedemption(input: {
  raw: string;
  buyerId: string;
  subtotalCents: number;
  listingKind: PromoContext["listingKind"];
  listingId: string | null;
  razorpayOrderId: string;
  now?: Date;
}): Promise<ReserveResult> {
  const evaluation = await evaluateCode({
    raw: input.raw,
    buyerId: input.buyerId,
    subtotalCents: input.subtotalCents,
    listingKind: input.listingKind,
    now: input.now,
  });
  if (!evaluation.ok) return evaluation;

  const { terms, quote } = evaluation;

  // Re-check the global cap against live redemption rows rather than the
  // denormalised counter, which only moves when a payment is granted.
  if (terms.maxRedemptions !== null) {
    const taken = await redemptionsForCode(terms.id);
    if (taken >= terms.maxRedemptions) {
      return {
        ok: false,
        reason: "code_exhausted",
        message: "That code has been fully claimed.",
      };
    }
  }

  const inserted = await db
    .insert(promoRedemptions)
    .values({
      promoCodeId: terms.id,
      buyerId: input.buyerId,
      razorpayOrderId: input.razorpayOrderId,
      subtotalCents: quote.subtotalCents,
      discountCents: quote.discountCents,
      chargedCents: quote.chargedCents,
      termsSnapshot: JSON.stringify(terms),
      listingKind: input.listingKind,
      listingId: input.listingId,
      status: "reserved",
    })
    .returning({ id: promoRedemptions.id });

  return { ok: true, quote, redemptionId: inserted[0].id };
}

/**
 * The reserved discount for an order, if any. The grant path uses this to price
 * the sale — never a number that came in over the wire.
 */
export async function redemptionForOrder(
  razorpayOrderId: string,
): Promise<typeof promoRedemptions.$inferSelect | null> {
  const row = await db.query.promoRedemptions.findFirst({
    where: eq(promoRedemptions.razorpayOrderId, razorpayOrderId),
  });
  return row ?? null;
}

/**
 * Settle a reservation once the payment has been granted.
 *
 * Idempotent: the WHERE clause only matches a row that is still "reserved", so
 * the webhook and verify-payment both firing cannot double-count the code.
 */
export async function markRedemptionApplied(
  razorpayOrderId: string,
): Promise<boolean> {
  const updated = await db
    .update(promoRedemptions)
    .set({ status: "applied", appliedAt: new Date() })
    .where(
      and(
        eq(promoRedemptions.razorpayOrderId, razorpayOrderId),
        eq(promoRedemptions.status, "reserved"),
      ),
    )
    .returning({ id: promoRedemptions.id, promoCodeId: promoRedemptions.promoCodeId });

  if (updated.length === 0) return false;

  await db
    .update(promoCodes)
    .set({
      timesRedeemed: sql`${promoCodes.timesRedeemed} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(promoCodes.id, updated[0].promoCodeId));

  return true;
}

/** Release a reservation whose checkout never completed. */
export async function voidRedemption(razorpayOrderId: string): Promise<void> {
  await db
    .update(promoRedemptions)
    .set({ status: "void" })
    .where(
      and(
        eq(promoRedemptions.razorpayOrderId, razorpayOrderId),
        eq(promoRedemptions.status, "reserved"),
      ),
    );
}
