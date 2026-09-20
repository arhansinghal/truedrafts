import { auth } from "@/lib/auth";
import { db, payouts, writerEarnings } from "@/lib/db";
import { isTrustedOrigin } from "@/lib/csrf";
import { and, eq, sql } from "drizzle-orm";
import { recordAdminAction, AUDIT_ACTIONS } from "@/lib/audit/record";

/**
 * Admin payout state machine. Enforces:
 *
 *   pending    → processing | paid | failed
 *   processing → paid | failed
 *   paid       → failed  (bank-reversal: NSF, chargeback, account closed days later)
 *   failed     → (terminal — writer's balance was returned)
 *
 * The CAS in the UPDATE WHERE clause makes the transition single-fire: a
 * concurrent or duplicate PATCH with the same status will affect zero rows and
 * skip the side effects entirely, so we can never double-deduct pendingCents.
 *
 * Earnings movement per transition:
 *   pending/processing → paid     : pendingCents -= amount  (money left writer)
 *   pending/processing → failed   : pendingCents -= amount; availableCents += amount
 *   paid              → failed   : availableCents += amount  (pendingCents already zeroed)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status } = (await req.json()) as {
    status?: "processing" | "paid" | "failed";
  };

  if (status !== "processing" && status !== "paid" && status !== "failed") {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

  const payout = await db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  if (!payout) return Response.json({ error: "Not found" }, { status: 404 });

  // Valid prior states for each target.
  const ALLOWED_FROM: Record<string, readonly string[]> = {
    processing: ["pending"],
    paid: ["pending", "processing"],
    failed: ["pending", "processing", "paid"], // paid→failed = bank reversal
  };
  if (!ALLOWED_FROM[status].includes(payout.status)) {
    return Response.json(
      { error: `Illegal transition: ${payout.status} → ${status}` },
      { status: 409 },
    );
  }

  if (status === "processing") {
    // No earnings movement — just record that admin is working on the transfer.
    const flipped = await db
      .update(payouts)
      .set({ status: "processing" })
      .where(and(eq(payouts.id, id), eq(payouts.status, "pending")))
      .returning({ id: payouts.id });
    if (flipped.length === 0) {
      return Response.json({ error: "Already updated" }, { status: 409 });
    }
    await auditTransition(req, session.user, payout, "processing");
    return Response.json({ ok: true });
  }

  if (status === "paid") {
    // Funds left to the writer. CAS-flip the payout + deduct pendingCents
    // atomically so a partial failure can't leave status=paid with
    // pendingCents still holding the amount (which would inflate the writer's
    // apparent balance forever).
    const ok = await db.transaction(async (tx) => {
      const flipped = await tx
        .update(payouts)
        .set({ status: "paid", paidAt: new Date() })
        .where(
          and(
            eq(payouts.id, id),
            sql`${payouts.status} in ('pending', 'processing')`,
          ),
        )
        .returning({ id: payouts.id });
      if (flipped.length === 0) return false;
      await tx
        .update(writerEarnings)
        .set({
          pendingCents: sql`GREATEST(0, ${writerEarnings.pendingCents} - ${payout.amountCents})`,
        })
        .where(eq(writerEarnings.writerId, payout.writerId));
      return true;
    });
    if (!ok) return Response.json({ error: "Already updated" }, { status: 409 });
    await auditTransition(req, session.user, payout, "paid");
    return Response.json({ ok: true });
  }

  // status === "failed": writer's balance restored. Two source-state branches:
  //   from pending/processing — amount was sitting in pendingCents; move it
  //                              back to availableCents.
  //   from paid                — amount already left pendingCents (when we
  //                              flipped to paid); only restore availableCents.
  const wasPaid = payout.status === "paid";
  const ok = await db.transaction(async (tx) => {
    const flipped = await tx
      .update(payouts)
      .set({ status: "failed" })
      .where(
        and(
          eq(payouts.id, id),
          wasPaid
            ? eq(payouts.status, "paid")
            : sql`${payouts.status} in ('pending', 'processing')`,
        ),
      )
      .returning({ id: payouts.id });
    if (flipped.length === 0) return false;
    if (wasPaid) {
      await tx
        .update(writerEarnings)
        .set({
          availableCents: sql`${writerEarnings.availableCents} + ${payout.amountCents}`,
        })
        .where(eq(writerEarnings.writerId, payout.writerId));
    } else {
      await tx
        .update(writerEarnings)
        .set({
          pendingCents: sql`GREATEST(0, ${writerEarnings.pendingCents} - ${payout.amountCents})`,
          availableCents: sql`${writerEarnings.availableCents} + ${payout.amountCents}`,
        })
        .where(eq(writerEarnings.writerId, payout.writerId));
    }
    return true;
  });
  if (!ok) return Response.json({ error: "Already updated" }, { status: 409 });
  await auditTransition(req, session.user, payout, "failed");
  return Response.json({ ok: true });
}

/**
 * Record a payout state change. Called only after the CAS won, so the log
 * contains one entry per transition that actually happened — never one per
 * duplicate PATCH that no-opped.
 */
async function auditTransition(
  req: Request,
  actor: { id: string; email: string },
  payout: { id: string; status: string; writerId: string; amountCents: number },
  next: string,
): Promise<void> {
  await recordAdminAction({
    req,
    actor,
    action: AUDIT_ACTIONS.payoutTransition,
    targetType: "payout",
    targetId: payout.id,
    targetLabel: `${payout.amountCents} paise to ${payout.writerId}`,
    before: { status: payout.status },
    after: { status: next },
  });
}
