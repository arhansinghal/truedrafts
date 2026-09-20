/**
 * Who may mark up what.
 *
 * Highlights sit on paid essay text, so the same rule that governs reading the
 * text governs marking it: you bought it, you wrote it, or you can't.
 */

import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type AccessVerdict =
  | { ok: true; writerId: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Can this user highlight this application?
 *
 * Mirrors the gate on the application page: a completed purchase, or being the
 * writer. Bundle children are ordinary `purchases` rows, so a bundle buyer is
 * covered by the same lookup.
 */
export async function canAnnotate(
  userId: string,
  applicationId: string,
): Promise<AccessVerdict> {
  const application = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, applicationId),
    columns: { id: true, writerId: true },
  });

  if (!application) {
    return { ok: false, status: 404, error: "Not found" };
  }

  if (application.writerId === userId) {
    return { ok: true, writerId: application.writerId };
  }

  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, userId),
      eq(purchases.applicationId, applicationId),
      eq(purchases.status, "completed"),
    ),
    columns: { id: true },
  });

  if (!purchase) {
    return {
      ok: false,
      status: 403,
      error: "Unlock this application before adding notes to it.",
    };
  }

  return { ok: true, writerId: application.writerId };
}
