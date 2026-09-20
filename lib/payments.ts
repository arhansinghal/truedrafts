/**
 * Razorpay entitlement grants. Both /api/razorpay/verify-payment (browser side)
 * and /api/webhooks/razorpay (server-to-server) call into these helpers — they
 * MUST be idempotent because both fire for the same successful payment, and
 * Razorpay webhook delivery itself retries multiple times.
 *
 * The contract:
 *   - INSERT ... ON CONFLICT DO NOTHING RETURNING id is the lock.
 *   - If no row is returned the payment was already granted — skip every
 *     side effect (counter bump, earnings credit, email). Return "already".
 *   - If a row IS returned this is the first observer — run all side effects
 *     and return "granted".
 *
 * Single-item idempotency key: purchases.razorpayPaymentId UNIQUE
 * Bundle idempotency key:      bundlePurchases.razorpayOrderId UNIQUE
 */

import { db } from "@/lib/db";
import {
  purchases,
  writerEarnings,
  writerUniversities,
  essays,
  collegeApplications,
  bundlePurchases,
  pendingBundleCheckouts,
} from "@/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { computeProRataSplits } from "@/lib/bundles";
import { splitWithPromo, splitWithoutPromo } from "@/lib/promo";
import { markRedemptionApplied, redemptionForOrder } from "@/lib/promo-store";
import {
  sendPurchaseBuyerEmail,
  sendPurchaseSellerEmail,
  sendPurchaseBundleBuyerEmail,
  sendPurchaseBundleSellerEmail,
} from "@/lib/email";

const PLATFORM_FEE_PCT = 0.5; // Platform keeps 50%, writers earn 50%

export type GrantResult = "granted" | "already" | "missing";

function assertValidAmount(amountCents: number, label: string): void {
  if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error(`${label}: invalid amountCents ${String(amountCents)}`);
  }
}

// ─── Single-item grants ──────────────────────────────────────────────────────

export async function grantEssayPurchase(input: {
  razorpayPaymentId: string;
  buyerId: string;
  essayId: string;
  amountCents: number;
}): Promise<GrantResult> {
  const { razorpayPaymentId, buyerId, essayId, amountCents } = input;
  assertValidAmount(amountCents, "grantEssayPurchase");
  const feeCents = Math.floor(amountCents * PLATFORM_FEE_PCT);
  const payoutCents = amountCents - feeCents;

  const inserted = await db
    .insert(purchases)
    .values({
      buyerId,
      essayId,
      amountCents,
      platformFeeCents: feeCents,
      writerPayoutCents: payoutCents,
      razorpayPaymentId,
      status: "completed",
    })
    .onConflictDoNothing({ target: purchases.razorpayPaymentId })
    .returning({ id: purchases.id });

  if (inserted.length === 0) return "already";

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, essayId),
    columns: { writerId: true, universityId: true },
  });
  if (!essay) return "missing";

  await db
    .update(essays)
    .set({ purchases: sql`${essays.purchases} + 1` })
    .where(eq(essays.id, essayId));

  await db
    .insert(writerEarnings)
    .values({
      writerId: essay.writerId,
      availableCents: payoutCents,
      totalEarnedCents: payoutCents,
    })
    .onConflictDoUpdate({
      target: writerEarnings.writerId,
      set: {
        availableCents: sql`${writerEarnings.availableCents} + ${payoutCents}`,
        totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${payoutCents}`,
        updatedAt: new Date(),
      },
    });

  // Carryover from the old essay flow: bump per-university progress for the
  // writer. Harmless no-op if no writerUniversities row exists.
  await db
    .update(writerUniversities)
    .set({
      applicationProgress: sql`LEAST(${writerUniversities.applicationProgress} + 20, 100)`,
    })
    .where(
      and(
        eq(writerUniversities.writerId, essay.writerId),
        eq(writerUniversities.universityId, essay.universityId),
      ),
    );

  // Email is best-effort — explicitly fire-and-forget so a slow SMTP can never
  // block grant. Errors are logged but never propagate to the caller.
  void Promise.all([
    sendPurchaseBuyerEmail(buyerId, essayId).catch(console.error),
    sendPurchaseSellerEmail(essay.writerId, essayId).catch(console.error),
  ]);

  return "granted";
}

export async function grantApplicationPurchase(input: {
  razorpayPaymentId: string;
  buyerId: string;
  applicationId: string;
  amountCents: number;
  /**
   * The order this payment settled. Optional only because the legacy essay
   * flow doesn't have one; applications always do, and without it a promo
   * redemption reserved at checkout cannot be found.
   */
  razorpayOrderId?: string;
}): Promise<GrantResult> {
  const { razorpayPaymentId, buyerId, applicationId, amountCents, razorpayOrderId } =
    input;
  assertValidAmount(amountCents, "grantApplicationPurchase");

  // A discounted sale splits differently: writers are paid on the list price
  // and the platform funds the discount out of its own half. See lib/promo.ts.
  const redemption = razorpayOrderId
    ? await redemptionForOrder(razorpayOrderId)
    : null;

  const split = redemption
    ? splitWithPromo({
        chargedCents: amountCents,
        listPriceCents: redemption.subtotalCents,
      })
    : splitWithoutPromo(amountCents);

  const feeCents = split.feeCents;
  const payoutCents = split.payoutCents;

  const inserted = await db
    .insert(purchases)
    .values({
      buyerId,
      applicationId,
      amountCents,
      platformFeeCents: feeCents,
      writerPayoutCents: payoutCents,
      razorpayPaymentId,
      status: "completed",
    })
    .onConflictDoNothing({ target: purchases.razorpayPaymentId })
    .returning({ id: purchases.id });

  if (inserted.length === 0) return "already";

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, applicationId),
    columns: { writerId: true },
  });
  if (!app) return "missing";

  await db
    .update(collegeApplications)
    .set({ purchases: sql`${collegeApplications.purchases} + 1` })
    .where(eq(collegeApplications.id, applicationId));

  await db
    .insert(writerEarnings)
    .values({
      writerId: app.writerId,
      availableCents: payoutCents,
      totalEarnedCents: payoutCents,
    })
    .onConflictDoUpdate({
      target: writerEarnings.writerId,
      set: {
        availableCents: sql`${writerEarnings.availableCents} + ${payoutCents}`,
        totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${payoutCents}`,
        updatedAt: new Date(),
      },
    });

  // Settle the promo reservation. Idempotent — only a row still in "reserved"
  // moves, so the webhook and verify-payment both firing can't double-count it.
  if (razorpayOrderId && redemption) {
    await markRedemptionApplied(razorpayOrderId).catch(console.error);
  }

  void Promise.all([
    sendPurchaseBuyerEmail(buyerId, applicationId).catch(console.error),
    sendPurchaseSellerEmail(app.writerId, applicationId).catch(console.error),
  ]);

  return "granted";
}

// ─── Bundle grant ────────────────────────────────────────────────────────────
//
// Bundles are keyed on razorpayOrderId rather than payment_id because the
// "purchase" identity is the order (one bundle order = one bundle purchase).
// Razorpay may attempt multiple payments against the same order before one
// captures; only the first captured payment crosses the lock.

export async function grantBundlePurchase(input: {
  razorpayOrderId: string;
  amountCents: number;
}): Promise<GrantResult> {
  const { razorpayOrderId, amountCents } = input;
  assertValidAmount(amountCents, "grantBundlePurchase");

  // Defense-in-depth: bundle checkout uses 'pending_<uuid>' as a placeholder
  // for the pending row before Razorpay returns the real order id. Only real
  // Razorpay order ids (order_<base62>) should ever reach a grant — anything
  // else is either data drift or a malformed call.
  if (!/^order_[A-Za-z0-9]{6,}$/.test(razorpayOrderId)) {
    console.error("grantBundlePurchase: malformed razorpayOrderId", razorpayOrderId);
    return "missing";
  }

  const pending = await db.query.pendingBundleCheckouts.findFirst({
    where: eq(pendingBundleCheckouts.razorpayOrderId, razorpayOrderId),
  });
  if (!pending) {
    // Could mean: already processed (pending row deleted) OR no pending row was
    // ever created (data drift). Disambiguate by checking the parent table.
    const existing = await db.query.bundlePurchases.findFirst({
      where: eq(bundlePurchases.razorpayOrderId, razorpayOrderId),
    });
    return existing ? "already" : "missing";
  }

  // Razorpay can collect a different amount than the order intended only via
  // partial payment, which we don't enable. Treat any mismatch as suspicious.
  if (amountCents !== pending.totalCents) {
    console.error("grantBundlePurchase: amount mismatch", {
      razorpayOrderId,
      paid: amountCents,
      expected: pending.totalCents,
    });
    return "missing";
  }

  const totalCents = pending.totalCents;
  const feeCents = Math.floor(totalCents * PLATFORM_FEE_PCT);
  const writerPayoutTotalCents = totalCents - feeCents;

  type Snap = { applicationId: string; priceCents: number };
  let priceSnapshot: Snap[];
  try {
    priceSnapshot = JSON.parse(pending.priceSnapshot);
  } catch {
    priceSnapshot = [];
  }
  if (priceSnapshot.length === 0) {
    console.error("Bundle priceSnapshot empty for order", razorpayOrderId);
    return "missing";
  }

  // Pro-rata split BOTH the writer total AND the platform fee by sticker price.
  // Doing the fee split via computeProRataSplits (which distributes the
  // remainder one paise at a time) instead of Math.round-and-clamp guarantees
  //   Σ writerShare = writerPayoutTotalCents
  //   Σ feeShare    = feeCents
  //   Σ amountCents = totalCents
  // with no reconciliation hack, no clamping, no chance of a negative fee.
  const writerSplits = computeProRataSplits(writerPayoutTotalCents, priceSnapshot);
  const writerSplitMap = new Map(writerSplits.map((s) => [s.applicationId, s.shareCents]));
  const feeSplits = computeProRataSplits(feeCents, priceSnapshot);
  const feeSplitMap = new Map(feeSplits.map((s) => [s.applicationId, s.shareCents]));

  const applicationIds = priceSnapshot.map((p) => p.applicationId);

  // Wrap parent insert + children + counters + earnings in a single tx so a
  // failure after the parent CAS win can't leave a granted parent with no
  // children (which would silently zero out writer payouts on retry).
  const parent = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(bundlePurchases)
      .values({
        buyerId: pending.buyerId,
        bundleId: pending.bundleId,
        totalCents,
        platformFeeCents: feeCents,
        writerPayoutTotalCents,
        applicationIdsSnapshot: pending.applicationIdsSnapshot,
        priceSnapshot: pending.priceSnapshot,
        razorpayOrderId,
        status: "completed",
      })
      .onConflictDoNothing({ target: bundlePurchases.razorpayOrderId })
      .returning({ id: bundlePurchases.id });
    if (inserted.length === 0) return null; // someone else won the CAS
    const parentRow = inserted[0];

    const childRows = priceSnapshot.map((p) => {
      const writerShare = writerSplitMap.get(p.applicationId) ?? 0;
      const feeShare = feeSplitMap.get(p.applicationId) ?? 0;
      return {
        buyerId: pending.buyerId,
        applicationId: p.applicationId,
        amountCents: writerShare + feeShare,
        platformFeeCents: feeShare,
        writerPayoutCents: writerShare,
        bundlePurchaseId: parentRow.id,
        status: "completed" as const,
      };
    });
    if (childRows.length > 0) {
      await tx.insert(purchases).values(childRows);
    }

    await tx
      .update(collegeApplications)
      .set({ purchases: sql`${collegeApplications.purchases} + 1` })
      .where(inArray(collegeApplications.id, applicationIds));

    return parentRow;
  });

  if (!parent) return "already";

  // Earnings credits + email side effects happen post-transaction. The grant
  // is already durable; if these fail, the buyer still owns the bundle and a
  // retry can re-credit writers (writerEarnings is an upsert).
  const apps = await db.query.collegeApplications.findMany({
    where: inArray(collegeApplications.id, applicationIds),
    columns: { id: true, writerId: true },
  });
  const writerTotals = new Map<string, number>();
  for (const a of apps) {
    const share = writerSplitMap.get(a.id) ?? 0;
    writerTotals.set(a.writerId, (writerTotals.get(a.writerId) ?? 0) + share);
  }
  for (const [writerId, share] of writerTotals.entries()) {
    if (share <= 0) continue;
    await db
      .insert(writerEarnings)
      .values({
        writerId,
        availableCents: share,
        totalEarnedCents: share,
      })
      .onConflictDoUpdate({
        target: writerEarnings.writerId,
        set: {
          availableCents: sql`${writerEarnings.availableCents} + ${share}`,
          totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${share}`,
          updatedAt: new Date(),
        },
      });
  }

  // Best-effort cleanup of the pending row; load-bearing idempotency lives on
  // bundlePurchases.razorpayOrderId UNIQUE.
  await db
    .delete(pendingBundleCheckouts)
    .where(eq(pendingBundleCheckouts.razorpayOrderId, razorpayOrderId))
    .catch(() => {});

  void Promise.all([
    sendPurchaseBundleBuyerEmail(parent.id).catch(console.error),
    ...apps.map((a) =>
      sendPurchaseBundleSellerEmail(
        a.writerId,
        parent.id,
        a.id,
        writerSplitMap.get(a.id) ?? 0,
      ).catch(console.error),
    ),
  ]);

  return "granted";
}

// ─── Note routing ────────────────────────────────────────────────────────────
//
// Razorpay orders carry server-set `notes`. The verify-payment and webhook
// handlers both read these to learn which flow + entity a payment belongs to.
// We always set: kind, ref_id, buyer_id.

export type RazorpayNotes = {
  kind?: string;
  ref_id?: string;
  buyer_id?: string;
} & Record<string, string | number | boolean>;

export function parseNotes(
  notes: Record<string, string | number | boolean> | undefined,
): { kind: "essay" | "application" | "bundle"; refId: string; buyerId: string } | null {
  if (!notes) return null;
  const kind = String(notes.kind ?? "");
  const refId = String(notes.ref_id ?? "");
  const buyerId = String(notes.buyer_id ?? "");
  if (!refId || !buyerId) return null;
  if (kind === "essay" || kind === "application" || kind === "bundle") {
    return { kind, refId, buyerId };
  }
  return null;
}
