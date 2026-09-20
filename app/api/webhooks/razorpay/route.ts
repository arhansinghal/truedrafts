/**
 * Razorpay webhook handler. Configure in Razorpay dashboard →
 * Account & Settings → Webhooks:
 *
 *   URL:    https://truedrafts.com/api/webhooks/razorpay
 *   Events: payment.captured, payment.failed, refund.processed,
 *           refund.created, refund.failed
 *   Secret: copy into RAZORPAY_WEBHOOK_SECRET env var
 *
 * The handler:
 *   1. Verifies the X-Razorpay-Signature HMAC against the raw body.
 *   2. Dispatches by event.type:
 *        - payment.captured           → grant entitlement (idempotent w/ verify-payment)
 *        - refund.processed/created   → reverse entitlement (CAS-protected)
 *        - refund.failed              → restore entitlement if we previously
 *                                       reversed it (CAS WHERE status='refunded'
 *                                       — no-op when there's nothing to undo)
 *        - payment.failed             → log only; no DB write
 *
 * Idempotency model: every flip is protected by a CAS on the row's current
 * status (e.g. WHERE status='completed' to flip to refunded). Duplicate
 * deliveries — Razorpay retries up to 24h by default — no-op safely. Razorpay
 * guarantees refund.processed and refund.failed are mutually exclusive per
 * refund, so an out-of-order delivery for the same refund cannot happen.
 *
 * Always returns 200 once the signature is valid, even on duplicates, so
 * Razorpay stops retrying — anything else gets stuck in a delivery loop.
 */

import { verifyWebhookSignature, fetchOrder, fetchPayment } from "@/lib/razorpay";
import {
  grantEssayPurchase,
  grantApplicationPurchase,
  grantBundlePurchase,
  parseNotes,
} from "@/lib/payments";
import { db } from "@/lib/db";
import {
  purchases,
  writerEarnings,
  essays,
  collegeApplications,
  bundlePurchases,
} from "@/lib/db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

type WebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, string | number | boolean>;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
      };
    };
  };
};

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  let valid: boolean;
  try {
    valid = verifyWebhookSignature(raw, signature);
  } catch (err) {
    // RAZORPAY_WEBHOOK_SECRET not set, etc. — config error, not Razorpay's
    // problem. Return 500 so the webhook gets retried after we fix env.
    console.error("Razorpay webhook config error:", err);
    return new Response("Webhook misconfigured", { status: 500 });
  }
  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let evt: WebhookEvent;
  try {
    evt = JSON.parse(raw) as WebhookEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  switch (evt.event) {
    case "payment.captured":
      return handlePaymentCaptured(evt);
    case "payment.failed":
      console.warn("Razorpay payment.failed:", evt.payload?.payment?.entity?.id);
      return new Response("ok", { status: 200 });
    case "refund.processed":
    case "refund.created":
      return handleRefund(evt);
    case "refund.failed":
      // Razorpay attempted the refund but the bank rejected it (NSF, account
      // closed, etc.). We previously reversed earnings + flipped status; now
      // we have to undo that so the buyer's money is back where it started in
      // our books, and the writer's earnings are restored.
      return handleRefundFailed(evt);
    default:
      // Unknown / unsubscribed event — ack it so Razorpay stops retrying.
      return new Response("ok", { status: 200 });
  }
}

async function handlePaymentCaptured(evt: WebhookEvent): Promise<Response> {
  const p = evt.payload?.payment?.entity;
  if (
    !p?.id ||
    !p.order_id ||
    !Number.isFinite(p.amount) ||
    !Number.isInteger(p.amount) ||
    (p.amount as number) <= 0
  ) {
    console.error("Razorpay webhook: malformed payment.captured payload");
    return new Response("ok", { status: 200 }); // ack to stop retries
  }

  if (p.currency && p.currency !== "INR") {
    console.error("Razorpay webhook: non-INR currency rejected", {
      paymentId: p.id,
      currency: p.currency,
    });
    return new Response("ok", { status: 200 });
  }

  // Order notes do NOT propagate to payment notes — always fetch the order.
  let routed: ReturnType<typeof parseNotes> = null;
  try {
    const order = await fetchOrder(p.order_id);
    if (p.amount !== order.amount) {
      console.error("Razorpay webhook: payment/order amount mismatch", {
        paymentId: p.id,
        orderId: p.order_id,
        paymentAmount: p.amount,
        orderAmount: order.amount,
      });
      return new Response("ok", { status: 200 });
    }
    if (order.currency !== "INR") {
      console.error("Razorpay webhook: order non-INR currency", {
        orderId: p.order_id,
        currency: order.currency,
      });
      return new Response("ok", { status: 200 });
    }
    routed = parseNotes(order.notes);
  } catch (err) {
    console.error("Razorpay webhook: fetchOrder failed:", err);
    // Transient Razorpay error — let it retry.
    return new Response("fetchOrder failed", { status: 502 });
  }

  if (!routed) {
    console.error("Razorpay webhook: missing/unrecognized notes on order", {
      paymentId: p.id,
      orderId: p.order_id,
    });
    return new Response("ok", { status: 200 });
  }

  try {
    let result;
    switch (routed.kind) {
      case "essay":
        result = await grantEssayPurchase({
          razorpayPaymentId: p.id,
          buyerId: routed.buyerId,
          essayId: routed.refId,
          amountCents: p.amount as number,
        });
        break;
      case "application":
        result = await grantApplicationPurchase({
          razorpayPaymentId: p.id,
          buyerId: routed.buyerId,
          applicationId: routed.refId,
          amountCents: p.amount as number,
          razorpayOrderId: p.order_id as string,
        });
        break;
      case "bundle":
        result = await grantBundlePurchase({
          razorpayOrderId: p.order_id,
          amountCents: p.amount as number,
        });
        break;
    }
    if (result === "missing") {
      console.error("Razorpay webhook: referenced item missing", routed);
    }
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Razorpay webhook: grant failed:", err);
    // 500 → Razorpay will retry. Better to retry than silently drop.
    return new Response("grant failed", { status: 500 });
  }
}

async function handleRefund(evt: WebhookEvent): Promise<Response> {
  const r = evt.payload?.refund?.entity;
  if (!r?.payment_id) return new Response("ok", { status: 200 });

  // Try single-item purchase first (keyed on razorpayPaymentId).
  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.razorpayPaymentId, r.payment_id),
  });
  if (purchase) {
    return reverseSingleItem(purchase);
  }

  // Otherwise it could be a bundle parent — bundles are keyed on
  // razorpayOrderId, not razorpayPaymentId. Look up the payment's order_id and
  // try to match a bundle parent. If neither matches, ack (it's a refund for a
  // payment we don't know about).
  const orderId = await orderIdForPayment(r.payment_id);
  if (!orderId) return new Response("ok", { status: 200 });

  const bundle = await db.query.bundlePurchases.findFirst({
    where: eq(bundlePurchases.razorpayOrderId, orderId),
  });
  if (!bundle) return new Response("ok", { status: 200 });

  return reverseBundle(bundle.id);
}

async function reverseSingleItem(purchase: {
  id: string;
  status: string;
  writerPayoutCents: number;
  essayId: string | null;
  applicationId: string | null;
}): Promise<Response> {
  // Resolve writerId outside the transaction since findFirst calls won't run
  // inside a tx with the same pooled session here.
  let writerId: string | null = null;
  if (purchase.essayId) {
    const e = await db.query.essays.findFirst({
      where: eq(essays.id, purchase.essayId),
      columns: { writerId: true },
    });
    writerId = e?.writerId ?? null;
  } else if (purchase.applicationId) {
    const a = await db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, purchase.applicationId),
      columns: { writerId: true },
    });
    writerId = a?.writerId ?? null;
  }

  // CAS flip + counter decrement + earnings reversal must all succeed or fail
  // together. Otherwise the CAS could win, status='refunded' commits, but the
  // earnings reversal fails (DB blip) — and on Razorpay retry the CAS skips
  // (status already 'refunded'), so earnings are never reversed.
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(purchases)
      .set({ status: "refunded" })
      .where(and(eq(purchases.id, purchase.id), eq(purchases.status, "completed")))
      .returning({ id: purchases.id });
    if (updated.length === 0) return; // someone else won — no side effects

    if (purchase.essayId) {
      await tx
        .update(essays)
        .set({ purchases: sql`GREATEST(${essays.purchases} - 1, 0)` })
        .where(eq(essays.id, purchase.essayId));
    } else if (purchase.applicationId) {
      await tx
        .update(collegeApplications)
        .set({ purchases: sql`GREATEST(${collegeApplications.purchases} - 1, 0)` })
        .where(eq(collegeApplications.id, purchase.applicationId));
    }

    if (writerId) {
      await tx
        .update(writerEarnings)
        .set({
          availableCents: sql`GREATEST(${writerEarnings.availableCents} - ${purchase.writerPayoutCents}, 0)`,
          totalEarnedCents: sql`GREATEST(${writerEarnings.totalEarnedCents} - ${purchase.writerPayoutCents}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(writerEarnings.writerId, writerId));
    }
  });

  return new Response("ok", { status: 200 });
}

async function reverseBundle(bundleParentId: string): Promise<Response> {
  // Pre-read children + writer mapping outside the tx — these are read-only
  // and we use them to compute the reversal amounts. The transaction below
  // then flips status + decrements counters + reverses earnings atomically.
  const children = await db.query.purchases.findMany({
    where: eq(purchases.bundlePurchaseId, bundleParentId),
  });
  const appIds = children
    .map((c) => c.applicationId)
    .filter((x): x is string => !!x);
  const writersById = appIds.length
    ? await db.query.collegeApplications.findMany({
        where: inArray(collegeApplications.id, appIds),
        columns: { id: true, writerId: true },
      })
    : [];
  const writerIdByApp = new Map(writersById.map((w) => [w.id, w.writerId]));

  const writerReversals = new Map<string, number>();
  for (const child of children) {
    if (!child.applicationId) continue;
    const writerId = writerIdByApp.get(child.applicationId);
    if (!writerId) continue;
    writerReversals.set(
      writerId,
      (writerReversals.get(writerId) ?? 0) + child.writerPayoutCents,
    );
  }

  await db.transaction(async (tx) => {
    const flipped = await tx
      .update(bundlePurchases)
      .set({ status: "refunded" })
      .where(
        and(
          eq(bundlePurchases.id, bundleParentId),
          eq(bundlePurchases.status, "completed"),
        ),
      )
      .returning({ id: bundlePurchases.id });
    if (flipped.length === 0) return; // someone else won

    await tx
      .update(purchases)
      .set({ status: "refunded" })
      .where(
        and(
          eq(purchases.bundlePurchaseId, bundleParentId),
          eq(purchases.status, "completed"),
        ),
      );

    if (appIds.length > 0) {
      await tx
        .update(collegeApplications)
        .set({ purchases: sql`GREATEST(${collegeApplications.purchases} - 1, 0)` })
        .where(inArray(collegeApplications.id, appIds));
    }

    for (const [writerId, amount] of writerReversals.entries()) {
      if (amount <= 0) continue;
      await tx
        .update(writerEarnings)
        .set({
          availableCents: sql`GREATEST(${writerEarnings.availableCents} - ${amount}, 0)`,
          totalEarnedCents: sql`GREATEST(${writerEarnings.totalEarnedCents} - ${amount}, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(writerEarnings.writerId, writerId));
    }
  });

  return new Response("ok", { status: 200 });
}

async function orderIdForPayment(paymentId: string): Promise<string | null> {
  try {
    const p = await fetchPayment(paymentId);
    return p.order_id ?? null;
  } catch (err) {
    console.error("orderIdForPayment failed:", err);
    return null;
  }
}

// ─── refund.failed — undo the reversal ───────────────────────────────────────

async function handleRefundFailed(evt: WebhookEvent): Promise<Response> {
  const r = evt.payload?.refund?.entity;
  if (!r?.payment_id) return new Response("ok", { status: 200 });

  console.error(
    `Razorpay refund.failed for payment ${r.payment_id} — restoring entitlement.`,
  );

  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.razorpayPaymentId, r.payment_id),
  });
  if (purchase) {
    return restoreSingleItem(purchase);
  }

  const orderId = await orderIdForPayment(r.payment_id);
  if (!orderId) return new Response("ok", { status: 200 });
  const bundle = await db.query.bundlePurchases.findFirst({
    where: eq(bundlePurchases.razorpayOrderId, orderId),
  });
  if (!bundle) return new Response("ok", { status: 200 });
  return restoreBundle(bundle.id);
}

async function restoreSingleItem(purchase: {
  id: string;
  status: string;
  writerPayoutCents: number;
  essayId: string | null;
  applicationId: string | null;
}): Promise<Response> {
  // Only act if status == 'refunded' (i.e. we previously reversed). If still
  // 'completed', nothing to undo. If 'refunded' but earnings were never
  // reversed (partial-failure scenario), the GREATEST clamps below are safe.
  let writerId: string | null = null;
  if (purchase.essayId) {
    const e = await db.query.essays.findFirst({
      where: eq(essays.id, purchase.essayId),
      columns: { writerId: true },
    });
    writerId = e?.writerId ?? null;
  } else if (purchase.applicationId) {
    const a = await db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, purchase.applicationId),
      columns: { writerId: true },
    });
    writerId = a?.writerId ?? null;
  }

  await db.transaction(async (tx) => {
    const flipped = await tx
      .update(purchases)
      .set({ status: "completed" })
      .where(and(eq(purchases.id, purchase.id), eq(purchases.status, "refunded")))
      .returning({ id: purchases.id });
    if (flipped.length === 0) return;

    if (purchase.essayId) {
      await tx
        .update(essays)
        .set({ purchases: sql`${essays.purchases} + 1` })
        .where(eq(essays.id, purchase.essayId));
    } else if (purchase.applicationId) {
      await tx
        .update(collegeApplications)
        .set({ purchases: sql`${collegeApplications.purchases} + 1` })
        .where(eq(collegeApplications.id, purchase.applicationId));
    }

    if (writerId) {
      await tx
        .insert(writerEarnings)
        .values({
          writerId,
          availableCents: purchase.writerPayoutCents,
          totalEarnedCents: purchase.writerPayoutCents,
        })
        .onConflictDoUpdate({
          target: writerEarnings.writerId,
          set: {
            availableCents: sql`${writerEarnings.availableCents} + ${purchase.writerPayoutCents}`,
            totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${purchase.writerPayoutCents}`,
            updatedAt: new Date(),
          },
        });
    }
  });

  return new Response("ok", { status: 200 });
}

async function restoreBundle(bundleParentId: string): Promise<Response> {
  const children = await db.query.purchases.findMany({
    where: eq(purchases.bundlePurchaseId, bundleParentId),
  });
  const appIds = children
    .map((c) => c.applicationId)
    .filter((x): x is string => !!x);
  const writersById = appIds.length
    ? await db.query.collegeApplications.findMany({
        where: inArray(collegeApplications.id, appIds),
        columns: { id: true, writerId: true },
      })
    : [];
  const writerIdByApp = new Map(writersById.map((w) => [w.id, w.writerId]));

  const restores = new Map<string, number>();
  for (const child of children) {
    if (!child.applicationId) continue;
    const writerId = writerIdByApp.get(child.applicationId);
    if (!writerId) continue;
    restores.set(
      writerId,
      (restores.get(writerId) ?? 0) + child.writerPayoutCents,
    );
  }

  await db.transaction(async (tx) => {
    const flipped = await tx
      .update(bundlePurchases)
      .set({ status: "completed" })
      .where(
        and(
          eq(bundlePurchases.id, bundleParentId),
          eq(bundlePurchases.status, "refunded"),
        ),
      )
      .returning({ id: bundlePurchases.id });
    if (flipped.length === 0) return;

    await tx
      .update(purchases)
      .set({ status: "completed" })
      .where(
        and(
          eq(purchases.bundlePurchaseId, bundleParentId),
          eq(purchases.status, "refunded"),
        ),
      );

    if (appIds.length > 0) {
      await tx
        .update(collegeApplications)
        .set({ purchases: sql`${collegeApplications.purchases} + 1` })
        .where(inArray(collegeApplications.id, appIds));
    }

    for (const [writerId, amount] of restores.entries()) {
      if (amount <= 0) continue;
      await tx
        .insert(writerEarnings)
        .values({
          writerId,
          availableCents: amount,
          totalEarnedCents: amount,
        })
        .onConflictDoUpdate({
          target: writerEarnings.writerId,
          set: {
            availableCents: sql`${writerEarnings.availableCents} + ${amount}`,
            totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${amount}`,
            updatedAt: new Date(),
          },
        });
    }
  });

  return new Response("ok", { status: 200 });
}
