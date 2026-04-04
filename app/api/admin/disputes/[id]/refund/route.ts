import { auth } from "@/lib/auth";
import { db, purchases, writerEarnings, essays } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { polarClient } from "@/lib/polar";

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

  // Issue refund via Polar if there's a polar order ID
  if (purchase.polarOrderId) {
    try {
      await polarClient.refunds.create({
        orderId: purchase.polarOrderId,
        amount: purchase.amountCents,
        reason: "customer_request",
        revokeBenefits: true,
      });
    } catch (err) {
      console.error("Polar refund error:", err);
      // Continue with local DB update even if Polar fails
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
