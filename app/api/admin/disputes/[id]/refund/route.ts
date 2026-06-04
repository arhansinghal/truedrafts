import { auth } from "@/lib/auth";
import { db, purchases, writerEarnings, essays } from "@/lib/db";
import { bundlePurchases, collegeApplications } from "@/lib/db/schema";
import { createRefund } from "@/lib/razorpay";
import { isTrustedOrigin } from "@/lib/csrf";
import { eq, and, sql, inArray } from "drizzle-orm";

/**
 * Admin-only purchase refund.
 *
 *   - Single-item purchases (purchases.id): refunds via Razorpay against the
 *     stored razorpayPaymentId, CAS-flips status='refunded' (so a concurrent
 *     refund webhook can't double-reverse earnings), and decrements the
 *     essay/application purchase counter.
 *   - Bundle parent purchases (bundlePurchases.id): refunds via Razorpay against
 *     the captured payment for the order, CAS-flips parent + all children,
 *     decrements every member application's counter, and reverses earnings
 *     for every writer on the bundle.
 *   - Bundle CHILD purchases (purchases.bundlePurchaseId != null): refund the
 *     PARENT (pass bundlePurchases.id instead). Refunding individual children
 *     is not supported because Razorpay refunds against the parent payment.
 *
 * The CAS pattern guarantees that the second concurrent caller — webhook or
 * admin — no-ops; only the call that wins the status flip runs side effects.
 * Idempotent.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Single-item path first.
  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.id, id),
  });
  if (purchase) {
    if (purchase.bundlePurchaseId) {
      return Response.json(
        {
          error:
            "This purchase is a bundle child. Refund the parent bundle purchase to refund all members together.",
        },
        { status: 400 },
      );
    }
    if (purchase.status === "refunded") {
      return Response.json({ error: "Already refunded" }, { status: 400 });
    }
    if (!purchase.razorpayPaymentId) {
      return Response.json(
        { error: "Purchase has no Razorpay payment id; cannot issue refund" },
        { status: 400 },
      );
    }
    return refundSingleItem(purchase);
  }

  // Bundle parent path.
  const bundle = await db.query.bundlePurchases.findFirst({
    where: eq(bundlePurchases.id, id),
  });
  if (!bundle) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (bundle.status === "refunded") {
    return Response.json({ error: "Already refunded" }, { status: 400 });
  }
  return refundBundle(bundle);
}

async function refundSingleItem(purchase: {
  id: string;
  razorpayPaymentId: string | null;
  amountCents: number;
  writerPayoutCents: number;
  essayId: string | null;
  applicationId: string | null;
}): Promise<Response> {
  // CAS FIRST — winning the status flip is the right to call Razorpay. Two
  // concurrent admins (or admin + webhook) can't both fire the refund API.
  const flipped = await db
    .update(purchases)
    .set({ status: "refunded" })
    .where(and(eq(purchases.id, purchase.id), eq(purchases.status, "completed")))
    .returning({ id: purchases.id });
  if (flipped.length === 0) {
    return Response.json({ ok: true, alreadyReversed: true });
  }

  try {
    await createRefund({
      paymentId: purchase.razorpayPaymentId!,
      amount: purchase.amountCents,
    });
  } catch (err) {
    // Revert the CAS so an admin can retry once Razorpay recovers.
    await db
      .update(purchases)
      .set({ status: "completed" })
      .where(eq(purchases.id, purchase.id));
    const message = err instanceof Error ? err.message : String(err);
    console.error("Razorpay refund failed:", message);
    return Response.json(
      { error: "Refund failed at Razorpay", detail: message },
      { status: 502 },
    );
  }

  // Resolve writerId outside the tx (read-only).
  let writerId: string | null = null;
  if (purchase.essayId) {
    const essay = await db.query.essays.findFirst({
      where: eq(essays.id, purchase.essayId),
      columns: { writerId: true },
    });
    writerId = essay?.writerId ?? null;
  } else if (purchase.applicationId) {
    const app = await db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, purchase.applicationId),
      columns: { writerId: true },
    });
    writerId = app?.writerId ?? null;
  }

  // Counter decrement + earnings reversal atomically. The CAS flip already
  // happened (and Razorpay was called) above; this transaction ensures the
  // two DB side effects either both commit or both roll back. Symmetric with
  // the webhook reverseSingleItem path.
  await db.transaction(async (tx) => {
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

  return Response.json({ ok: true });
}

async function refundBundle(bundle: {
  id: string;
  razorpayOrderId: string;
  totalCents: number;
}): Promise<Response> {
  // CAS FIRST — winning the parent status flip is the right to call Razorpay.
  // Two concurrent refund attempts can't both issue refunds against the same
  // payment(s).
  const flipped = await db
    .update(bundlePurchases)
    .set({ status: "refunded" })
    .where(and(eq(bundlePurchases.id, bundle.id), eq(bundlePurchases.status, "completed")))
    .returning({ id: bundlePurchases.id });
  if (flipped.length === 0) {
    return Response.json({ ok: true, alreadyReversed: true });
  }

  // Razorpay refunds are issued per-PAYMENT. An order normally has one captured
  // payment, but the schema permits multiple capture attempts — refund every
  // captured one so no customer money is left stranded.
  let captured: Array<{ id: string; status: string; amount: number }>;
  try {
    const all = await fetchOrderPayments(bundle.razorpayOrderId);
    captured = all.filter((p) => p.status === "captured");
    if (captured.length === 0) {
      // No captured payment to refund — undo the CAS so admin can re-evaluate.
      await db
        .update(bundlePurchases)
        .set({ status: "completed" })
        .where(eq(bundlePurchases.id, bundle.id));
      console.error("refundBundle: no captured payment for order", {
        orderId: bundle.razorpayOrderId,
      });
      return Response.json(
        { error: "No captured payment found for this bundle order" },
        { status: 400 },
      );
    }
  } catch (err) {
    await db
      .update(bundlePurchases)
      .set({ status: "completed" })
      .where(eq(bundlePurchases.id, bundle.id));
    const message = err instanceof Error ? err.message : String(err);
    console.error("refundBundle: payment lookup failed:", message);
    return Response.json(
      { error: "Failed to look up bundle payment", detail: message },
      { status: 502 },
    );
  }

  // Refund each captured payment in full. If ANY refund fails partway through,
  // we still have refunded any earlier ones — log loudly so ops can reconcile
  // manually. We do NOT revert the CAS, because at least some money has left
  // Razorpay and we must not allow a re-trigger to double-refund the rest.
  for (const cap of captured) {
    try {
      await createRefund({ paymentId: cap.id, amount: cap.amount });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `refundBundle: PARTIAL REFUND — refund failed for payment ${cap.id} after ` +
          `earlier captures refunded. Manual reconciliation required for order ${bundle.razorpayOrderId}.`,
        message,
      );
      return Response.json(
        {
          error: "Bundle refund partially failed; check logs for reconciliation",
          detail: message,
        },
        { status: 502 },
      );
    }
  }

  // Pre-read children + writer mapping outside the tx.
  const children = await db.query.purchases.findMany({
    where: eq(purchases.bundlePurchaseId, bundle.id),
  });
  const appIds = children
    .map((c) => c.applicationId)
    .filter((x): x is string => !!x);
  const apps =
    appIds.length > 0
      ? await db.query.collegeApplications.findMany({
          where: inArray(collegeApplications.id, appIds),
          columns: { id: true, writerId: true },
        })
      : [];
  const writerIdByApp = new Map(apps.map((a) => [a.id, a.writerId]));

  const reversals = new Map<string, number>();
  for (const child of children) {
    if (!child.applicationId) continue;
    const writerId = writerIdByApp.get(child.applicationId);
    if (!writerId) continue;
    reversals.set(writerId, (reversals.get(writerId) ?? 0) + child.writerPayoutCents);
  }

  // Atomic: child status flip + counter decrement + earnings reversal commit
  // together. If any leg fails, all roll back; admin can retry. Symmetric with
  // the webhook reverseBundle path.
  await db.transaction(async (tx) => {
    await tx
      .update(purchases)
      .set({ status: "refunded" })
      .where(
        and(
          eq(purchases.bundlePurchaseId, bundle.id),
          eq(purchases.status, "completed"),
        ),
      );

    if (appIds.length > 0) {
      await tx
        .update(collegeApplications)
        .set({ purchases: sql`GREATEST(${collegeApplications.purchases} - 1, 0)` })
        .where(inArray(collegeApplications.id, appIds));
    }

    for (const [writerId, amount] of reversals.entries()) {
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

  return Response.json({ ok: true });
}

async function fetchOrderPayments(
  orderId: string,
): Promise<Array<{ id: string; status: string; amount: number }>> {
  // /v1/orders/{order_id}/payments returns all payment attempts for an order.
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  const res = await fetch(
    `https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`,
    {
      headers: {
        Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Razorpay GET /orders/${orderId}/payments failed (${res.status})`);
  }
  const json = (await res.json()) as {
    items?: Array<{ id: string; status: string; amount: number }>;
  };
  return json.items ?? [];
}
