import { auth } from "@/lib/auth";
import { db, purchases, users, essays } from "@/lib/db";
import { eq, sql, count, sum } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [revenueResult, usersResult, essaysResult] = await Promise.all([
    db
      .select({
        gmvCents: sum(purchases.amountCents),
        platformRevenueCents: sum(purchases.platformFeeCents),
        writerPayoutsCents: sum(purchases.writerPayoutCents),
        totalPurchases: count(purchases.id),
      })
      .from(purchases)
      .where(eq(purchases.status, "completed")),

    db
      .select({
        totalReaders: sql<number>`count(*) filter (where role = 'reader')`,
        totalWriters: sql<number>`count(*) filter (where role = 'writer')`,
        newThisWeek: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`,
      })
      .from(users),

    db
      .select({
        pendingReview: sql<number>`count(*) filter (where status = 'pending')`,
        live: sql<number>`count(*) filter (where status = 'approved')`,
        rejected: sql<number>`count(*) filter (where status = 'rejected')`,
      })
      .from(essays),
  ]);

  return Response.json({
    revenue: revenueResult[0],
    users: usersResult[0],
    essays: essaysResult[0],
  });
}
