import { auth } from "@/lib/auth";
import { db, writerEarnings, payouts } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

const MIN_PAYOUT_CENTS = 1000; // $10.00

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const earnings = await db.query.writerEarnings.findFirst({
    where: eq(writerEarnings.writerId, session.user.id),
  });

  if (!earnings || earnings.availableCents < MIN_PAYOUT_CENTS) {
    return Response.json(
      { error: `Minimum payout is $${MIN_PAYOUT_CENTS / 100}` },
      { status: 400 }
    );
  }

  const amountCents = earnings.availableCents;

  // Create payout record
  const [payout] = await db
    .insert(payouts)
    .values({
      writerId: session.user.id,
      amountCents,
      status: "pending",
    })
    .returning();

  // Move available to pending
  await db
    .update(writerEarnings)
    .set({
      availableCents: 0,
      pendingCents: sql`${writerEarnings.pendingCents} + ${amountCents}`,
    })
    .where(eq(writerEarnings.writerId, session.user.id));

  // In production: call polarClient to initiate Stripe Connect transfer
  // await polarClient.payouts.create({ ... })

  return Response.json(payout, { status: 201 });
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
