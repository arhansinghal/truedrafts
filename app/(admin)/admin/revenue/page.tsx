import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { purchases, users, writerEarnings, collegeApplications } from "@/lib/db/schema";
import { eq, sum, count, desc } from "drizzle-orm";
import { formatCents, timeAgo } from "@/lib/utils";
import { DollarSign, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revenue — Admin" };

export default async function AdminRevenuePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const [revResult, allPurchases, topWriters] = await Promise.all([
    db.select({
      gmvCents: sum(purchases.amountCents),
      platformCents: sum(purchases.platformFeeCents),
      payoutsCents: sum(purchases.writerPayoutCents),
      totalPurchases: count(purchases.id),
    }).from(purchases).where(eq(purchases.status, "completed")),

    db.query.purchases.findMany({
      where: eq(purchases.status, "completed"),
      with: {
        essay: { columns: { title: true } },
        application: { columns: { title: true } },
        buyer: { columns: { name: true } },
      },
      orderBy: [desc(purchases.purchasedAt)],
      limit: 30,
    }),

    db.select({
      writerId: writerEarnings.writerId,
      totalEarned: writerEarnings.totalEarnedCents,
    }).from(writerEarnings).orderBy(desc(writerEarnings.totalEarnedCents)).limit(10),
  ]);

  const topWriterDetails = await Promise.all(
    topWriters.map(async ({ writerId, totalEarned }) => {
      const writer = await db.query.users.findFirst({
        where: eq(users.id, writerId),
        columns: { name: true, email: true },
      });
      return { writerId, totalEarned, name: writer?.name ?? "Unknown", email: writer?.email ?? "" };
    })
  );

  const rev = revResult[0];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <DollarSign className="h-5 w-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatCents(Number(rev?.gmvCents ?? 0))}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total GMV</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <TrendingUp className="h-5 w-5 text-[#0851A0] mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatCents(Number(rev?.platformCents ?? 0))}</p>
          <p className="text-xs text-gray-500 mt-0.5">Platform Revenue</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <Users className="h-5 w-5 text-purple-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{rev?.totalPurchases ?? 0}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Purchases</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Writer leaderboard */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Top Earning Writers</h2>
          {topWriterDetails.length === 0 ? (
            <p className="text-sm text-gray-400">No earnings data yet.</p>
          ) : (
            <div className="space-y-2">
              {topWriterDetails.map(({ writerId, totalEarned, name }, i) => (
                <div key={writerId} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-5">{i + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-[#e8f1fa] flex items-center justify-center text-xs font-bold text-[#0851A0] shrink-0">
                    {name[0]}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">{name}</span>
                  <span className="text-sm font-semibold text-green-600">{formatCents(Number(totalEarned ?? 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent purchases */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Recent Purchases</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allPurchases.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{p.essay?.title ?? p.application?.title ?? "Purchase"}</p>
                  <p className="text-xs text-gray-400">{p.buyer.name} · {timeAgo(p.purchasedAt)}</p>
                </div>
                <span className="text-sm font-semibold text-green-600 shrink-0">{formatCents(p.amountCents)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
