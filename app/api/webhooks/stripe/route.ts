import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { purchases, writerEarnings, collegeApplications, essays } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe webhook signature error:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") return new Response("ok", { status: 200 });

    const applicationId = session.metadata?.application_id;
    const buyerId = session.metadata?.buyer_id;

    if (!applicationId || !buyerId) {
      return new Response("Missing metadata", { status: 400 });
    }

    const amountCents = session.amount_total ?? 0;
    const feeCents = Math.floor(amountCents * 0.5);
    const payoutCents = amountCents - feeCents;
    const stripeSessionId = session.id;

    // Idempotency check
    const existing = await db.query.purchases.findFirst({
      where: eq(purchases.polarOrderId, stripeSessionId),
    });
    if (existing) return new Response("Already processed", { status: 200 });

    // Insert purchase
    await db.insert(purchases).values({
      buyerId,
      applicationId,
      amountCents,
      platformFeeCents: feeCents,
      writerPayoutCents: payoutCents,
      polarOrderId: stripeSessionId, // reusing column as generic payment ID
      status: "completed",
    }).onConflictDoNothing();

    // Increment purchase count
    await db.update(collegeApplications)
      .set({ purchases: sql`${collegeApplications.purchases} + 1` })
      .where(eq(collegeApplications.id, applicationId));

    // Upsert writer earnings
    const app = await db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, applicationId),
    });

    if (app) {
      await db.insert(writerEarnings).values({
        writerId: app.writerId,
        availableCents: payoutCents,
        totalEarnedCents: payoutCents,
      }).onConflictDoUpdate({
        target: writerEarnings.writerId,
        set: {
          availableCents: sql`${writerEarnings.availableCents} + ${payoutCents}`,
          totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${payoutCents}`,
          updatedAt: new Date(),
        },
      });
    }
  }

  return new Response("ok", { status: 200 });
}
