import { auth } from "@/lib/auth";
import { db, writerEarnings, payouts } from "@/lib/db";
import { writerPayoutMethods } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { and, eq, sql } from "drizzle-orm";
import { formatCents } from "@/lib/utils";
import {
  buildPayoutMethodSnapshot,
  maskPayoutMethodForWriter,
} from "@/lib/payout-methods";
import { recordLedgerEntry } from "@/lib/ledger/record";

// Minimum payout threshold in paise. ₹1000 ≈ $12, matches the prior $10 floor.
const MIN_PAYOUT_CENTS = 100000;

export async function POST(req: Request) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const writerId = session.user.id;

  // A writer must have a default payout method on file before requesting a
  // payout. Without this, admin has nowhere to send the money.
  const method = await db.query.writerPayoutMethods.findFirst({
    where: and(
      eq(writerPayoutMethods.writerId, writerId),
      eq(writerPayoutMethods.isDefault, true),
    ),
  });
  if (!method) {
    return Response.json(
      {
        error: "payout_method_required",
        message:
          "Add a payout method (UPI, bank account, or Zelle) before requesting a payout.",
      },
      { status: 422 },
    );
  }
  const snapshot = buildPayoutMethodSnapshot(maskPayoutMethodForWriter(method));

  // Wrap the read + decrement + insert in a transaction with a row-level lock
  // (SELECT … FOR UPDATE) on writerEarnings. Two concurrent requests serialize
  // on the same row; whichever lands second sees availableCents=0 and bails.
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ available: writerEarnings.availableCents })
      .from(writerEarnings)
      .where(eq(writerEarnings.writerId, writerId))
      .for("update");
    const amountCents = rows[0]?.available ?? 0;
    if (amountCents < MIN_PAYOUT_CENTS) return null;

    await tx
      .update(writerEarnings)
      .set({
        availableCents: 0,
        pendingCents: sql`${writerEarnings.pendingCents} + ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(writerEarnings.writerId, writerId));

    const [payout] = await tx
      .insert(payouts)
      .values({
        writerId,
        amountCents,
        status: "pending",
        payoutMethodId: method.id,
        payoutMethodSnapshot: snapshot,
      })
      .returning();
    return payout;
  });

  if (!result) {
    return Response.json(
      { error: `Minimum payout is ${formatCents(MIN_PAYOUT_CENTS)}` },
      { status: 400 },
    );
  }

  // The debit goes on the ledger as soon as the money is committed, not when
  // admin marks it paid — from the writer's side it left their balance here.
  await recordLedgerEntry({
    writerId,
    entryType: "payout",
    amountCents: result.amountCents,
    sourceType: "payout",
    sourceId: result.id,
    memo: "Payout requested",
  });

  return Response.json(result, { status: 201 });
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.payouts.findMany({
    where: eq(payouts.writerId, session.user.id),
    orderBy: (p, { desc }) => [desc(p.requestedAt)],
  });

  return Response.json(rows);
}
