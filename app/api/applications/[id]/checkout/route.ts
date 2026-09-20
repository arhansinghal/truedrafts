import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
import { createOrder } from "@/lib/razorpay";
import { isTrustedOrigin } from "@/lib/csrf";
import { evaluateCode, reserveRedemption } from "@/lib/promo-store";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Writer accounts can browse but not purchase — purchasing is a reader action.
  if (session.user.role === "writer") {
    return Response.json(
      { error: "Writer accounts can't purchase. Use a reader account to buy applications." },
      { status: 403 },
    );
  }

  // The promo code is optional; a body is not required at all for the ordinary
  // full-price path, so a missing or unparseable body is not an error.
  let promoCodeInput = "";
  try {
    const body = await req.json();
    if (body && typeof body.promoCode === "string") {
      promoCodeInput = body.promoCode;
    }
  } catch {
    promoCodeInput = "";
  }

  const existing = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, session.user.id),
      eq(purchases.applicationId, id),
      eq(purchases.status, "completed"),
    ),
  });
  if (existing) {
    return Response.json({ error: "Already purchased" }, { status: 400 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: { university: { columns: { name: true } } },
  });

  if (!app || app.status !== "approved") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (app.writerId === session.user.id) {
    return Response.json(
      { error: "You cannot purchase your own application" },
      { status: 400 },
    );
  }

  if (app.priceCents < 100) {
    return Response.json(
      { error: "Application price below Razorpay minimum (₹1)" },
      { status: 400 },
    );
  }

  // Price the order server-side. The client may send a code but never a price;
  // whatever discount lands here is the one the grant path will honour.
  let chargeCents = app.priceCents;
  let quotedDiscountCents = 0;

  if (promoCodeInput.trim()) {
    const evaluation = await evaluateCode({
      raw: promoCodeInput,
      buyerId: session.user.id,
      subtotalCents: app.priceCents,
      listingKind: "application",
    });

    if (!evaluation.ok) {
      return Response.json(
        { error: "promo_rejected", reason: evaluation.reason, message: evaluation.message },
        { status: 422 },
      );
    }

    chargeCents = evaluation.quote.chargedCents;
    quotedDiscountCents = evaluation.quote.discountCents;

    if (chargeCents < 100) {
      return Response.json(
        {
          error: "promo_rejected",
          reason: "below_gateway_minimum",
          message: "That code brings the total below the ₹1 minimum we can charge.",
        },
        { status: 422 },
      );
    }
  }

  try {
    const order = await createOrder({
      amount: chargeCents,
      currency: "INR",
      receipt: `app_${randomUUID().slice(0, 16)}`,
      notes: {
        kind: "application",
        ref_id: app.id,
        buyer_id: session.user.id,
      },
    });

    if (promoCodeInput.trim()) {
      const reservation = await reserveRedemption({
        raw: promoCodeInput,
        buyerId: session.user.id,
        subtotalCents: app.priceCents,
        listingKind: "application",
        listingId: app.id,
        razorpayOrderId: order.id,
      });

      // If the code slipped out from under us between the quote and the
      // reservation, fail the checkout rather than charging a discounted price
      // for a code we never recorded.
      if (!reservation.ok) {
        return Response.json(
          {
            error: "promo_rejected",
            reason: reservation.reason,
            message: reservation.message,
          },
          { status: 422 },
        );
      }
    }

    return Response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      name: "TrueDrafts",
      description: `Unlock: ${app.title}`.slice(0, 250),
      prefill: { email: session.user.email, name: session.user.name },
      listPriceCents: app.priceCents,
      discountCents: quotedDiscountCents,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Razorpay application checkout error:", message);
    const status = (err as Error & { status?: number }).status === 401 ? 401 : 500;
    return Response.json(
      { error: status === 401 ? "Payment auth failed" : "Checkout failed" },
      { status },
    );
  }
}
