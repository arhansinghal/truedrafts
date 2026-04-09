import { auth } from "@/lib/auth";
import { db, payouts, writerEarnings } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = await req.json() as { status: "processing" | "paid" | "failed" };

  if (!["processing", "paid", "failed"].includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const payout = await db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  if (!payout) return Response.json({ error: "Not found" }, { status: 404 });

  if (status === "paid") {
    // Deduct from pendingCents (payout is now resolved)
    await Promise.all([
      db.update(payouts).set({ status: "paid", paidAt: new Date() }).where(eq(payouts.id, id)),
      db.update(writerEarnings)
        .set({
          pendingCents: sql`GREATEST(0, ${writerEarnings.pendingCents} - ${payout.amountCents})`,
        })
        .where(eq(writerEarnings.writerId, payout.writerId)),
    ]);
  } else if (status === "failed") {
    // Return amount to availableCents so writer can try again
    await Promise.all([
      db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, id)),
      db.update(writerEarnings)
        .set({
          pendingCents: sql`GREATEST(0, ${writerEarnings.pendingCents} - ${payout.amountCents})`,
          availableCents: sql`${writerEarnings.availableCents} + ${payout.amountCents}`,
        })
        .where(eq(writerEarnings.writerId, payout.writerId)),
    ]);
  } else {
    // processing — just update status
    await db.update(payouts).set({ status: "processing" }).where(eq(payouts.id, id));
  }

  return Response.json({ ok: true });
}
