import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { db, essays, purchases, writerEarnings, writerUniversities } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { sendPurchaseConfirmation, sendWriterSaleNotification } from "@/lib/resend";
import { eq, sql, and } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.text();
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET ?? "";
  const headers = Object.fromEntries(req.headers.entries());

  let event: ReturnType<typeof validateEvent> | { type: string; data: Record<string, unknown> };

  if (webhookSecret) {
    try {
      event = validateEvent(body, headers, webhookSecret);
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return new Response("Invalid webhook signature", { status: 403 });
      }
      return new Response("Webhook processing error", { status: 500 });
    }
  } else {
    try {
      event = JSON.parse(body) as { type: string; data: Record<string, unknown> };
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
  }

  if (event.type === "order.paid") {
    const data = event.data as {
      id: string;
      totalAmount: number;
      metadata?: Record<string, string | number | boolean>;
    };

    const essayId = data.metadata?.essay_id as string | undefined;
    const applicationId = data.metadata?.application_id as string | undefined;
    const buyerId = data.metadata?.buyer_id as string | undefined;

    if ((!essayId && !applicationId) || !buyerId) {
      return new Response("Missing metadata", { status: 400 });
    }

    const amountCents = data.totalAmount;
    const feeCents = Math.floor(amountCents * 0.5);
    const payoutCents = amountCents - feeCents;

    // Idempotency check
    const existing = await db.query.purchases.findFirst({
      where: eq(purchases.polarOrderId, data.id),
    });
    if (existing) return new Response("Already processed", { status: 200 });

    // ── Application purchase ───────────────────────────────────────────────
    if (applicationId) {
      await db.insert(purchases).values({
        buyerId,
        applicationId,
        amountCents,
        platformFeeCents: feeCents,
        writerPayoutCents: payoutCents,
        polarOrderId: data.id,
        status: "completed",
      });

      await db
        .update(collegeApplications)
        .set({ purchases: sql`${collegeApplications.purchases} + 1` })
        .where(eq(collegeApplications.id, applicationId));

      const app = await db.query.collegeApplications.findFirst({
        where: eq(collegeApplications.id, applicationId),
      });

      if (app) {
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
      }

      return new Response("ok", { status: 200 });
    }

    // ── Legacy essay purchase ──────────────────────────────────────────────
    // Record purchase
    await db.insert(purchases).values({
      buyerId,
      essayId: essayId!,
      amountCents,
      platformFeeCents: feeCents,
      writerPayoutCents: payoutCents,
      polarOrderId: data.id,
      status: "completed",
    });

    // Increment essay purchases count
    await db
      .update(essays)
      .set({ purchases: sql`${essays.purchases} + 1` })
      .where(eq(essays.id, essayId!));

    const essay = await db.query.essays.findFirst({
      where: eq(essays.id, essayId!),
    });
    if (!essay) return new Response("Essay not found", { status: 404 });

    // Upsert writer earnings
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

    // Update application progress for this university
    await db
      .update(writerUniversities)
      .set({
        applicationProgress: sql`LEAST(${writerUniversities.applicationProgress} + 20, 100)`,
      })
      .where(
        and(
          eq(writerUniversities.writerId, essay.writerId),
          eq(writerUniversities.universityId, essay.universityId)
        )
      );

    // Send emails (non-blocking)
    Promise.all([
      sendPurchaseConfirmation(buyerId, essayId!),
      sendWriterSaleNotification(essay.writerId, buyerId, essayId!),
    ]).catch(console.error);
  }

  return new Response("ok", { status: 200 });
}
