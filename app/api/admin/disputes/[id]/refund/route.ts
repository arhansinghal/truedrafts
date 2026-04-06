import { auth } from "@/lib/auth";
import { db, purchases, writerEarnings, essays } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { eq, sql } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const purchase = await db.query.purchases.findFirst({
    where: eq(purchases.id, id),
  });
  if (!purchase) return Response.json({ error: "Not found" }, { status: 404 });
  if (purchase.status === "refunded") return Response.json({ error: "Already refunded" }, { status: 400 });

  // Issue refund via Stripe if there's a session ID stored
  if (purchase.polarOrderId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(purchase.polarOrderId);
      if (session.payment_intent) {
        await stripe.refunds.create({
          payment_intent: session.payment_intent as string,
          reason: "requested_by_customer",
        });
      }
    } catch (err) {
      console.error("Stripe refund error:", err);
      // Continue with local DB update even if Stripe fails
    }
  }

  // Mark purchase as refunded
  await db.update(purchases).set({ status: "refunded" }).where(eq(purchases.id, id));

  // Deduct from writer earnings
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

  if (writerId) {
    await db.update(writerEarnings).set({
      availableCents: sql`GREATEST(${writerEarnings.availableCents} - ${purchase.writerPayoutCents}, 0)`,
      totalEarnedCents: sql`GREATEST(${writerEarnings.totalEarnedCents} - ${purchase.writerPayoutCents}, 0)`,
      updatedAt: new Date(),
    }).where(eq(writerEarnings.writerId, writerId));
  }

  return Response.json({ ok: true });
}
