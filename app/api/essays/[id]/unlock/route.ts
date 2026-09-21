import { auth } from "@/lib/auth";
import { db, essays, purchases, writerEarnings } from "@/lib/db";
import { creditLedger, userCredits } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// Platform keeps 50% on a credit unlock, same split as a card purchase, so a
// writer's earnings don't depend on how the buyer paid.
const PLATFORM_FEE_PCT = 0.5;

/** Spend one unlock credit to buy an essay. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const buyerId = session.user.id;

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    columns: { id: true, writerId: true, priceCents: true, status: true },
  });
  if (!essay || essay.status !== "approved") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const credits = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, buyerId),
  });
  if (!credits || credits.balance < 1) {
    return Response.json(
      { error: "no_credits", message: "You have no unlock credits left." },
      { status: 402 },
    );
  }

  await db
    .update(userCredits)
    .set({ balance: credits.balance - 1, updatedAt: new Date() })
    .where(eq(userCredits.userId, buyerId));

  await db.insert(creditLedger).values({
    userId: buyerId,
    delta: -1,
    reason: "essay_unlock",
    essayId: id,
  });

  const amountCents = essay.priceCents;
  const feeCents = Math.floor(amountCents * PLATFORM_FEE_PCT);
  const payoutCents = amountCents - feeCents;

  await db.insert(purchases).values({
    buyerId,
    essayId: id,
    amountCents,
    platformFeeCents: feeCents,
    writerPayoutCents: payoutCents,
    status: "completed",
  });

  await db
    .update(essays)
    .set({ purchases: sql`${essays.purchases} + 1` })
    .where(eq(essays.id, id));

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

  return Response.json({ ok: true, remaining: credits.balance - 1 });
}
