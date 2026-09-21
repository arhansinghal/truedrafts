/**
 * Referral bonuses.
 *
 * A reader who signs up through someone's referral link gets a `referrals`
 * row at signup (referrerId → referredUserId, bonusCents = 0). The referrer
 * earns a cut of that reader's FIRST purchase, credited to the referrer's
 * writer-earnings balance — referrers are writers in practice, the code lives
 * on the writer profile — and `referrals.bonus_cents` records what was paid.
 */

import { db } from "@/lib/db";
import { referrals, writerEarnings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/** The referrer keeps 10% of the referred reader's purchase. */
export const REFERRAL_BONUS_PCT = 0.1;

/**
 * Credits the referrer of `buyerId`, if there is one, for a purchase of
 * `amountCents`. Readers with no referrer are the common case, so this is a
 * cheap lookup that returns early.
 *
 * Never throws: a referral bonus must not be able to fail a payment that has
 * already settled, so problems are logged and swallowed.
 */
export async function creditReferralBonus(input: {
  buyerId: string;
  amountCents: number;
}): Promise<void> {
  const { buyerId, amountCents } = input;

  try {
    const referral = await db.query.referrals.findFirst({
      where: eq(referrals.referredUserId, buyerId),
      columns: { id: true, referrerId: true },
    });
    if (!referral) return;

    const bonusCents = amountCents * REFERRAL_BONUS_PCT;

    await db
      .update(writerEarnings)
      .set({
        availableCents: sql`${writerEarnings.availableCents} + ${bonusCents}`,
        totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${bonusCents}`,
        updatedAt: new Date(),
      })
      .where(eq(writerEarnings.writerId, referral.referrerId));

    await db
      .update(referrals)
      .set({ bonusCents: sql`${referrals.bonusCents} + ${bonusCents}` })
      .where(eq(referrals.id, referral.id));
  } catch (err) {
    console.error("creditReferralBonus failed:", err);
  }
}
