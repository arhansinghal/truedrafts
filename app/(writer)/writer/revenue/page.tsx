import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { writerEarnings, payouts, purchases, collegeApplications } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { PayoutButton } from "@/components/writer/PayoutButton";
import { formatCents, timeAgo } from "@/lib/utils";
import { TrendingUp, DollarSign, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Revenue" };

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  processing: "bg-blue-50 text-[#063d85] border-blue-200",
  paid: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
};

export default async function RevenuePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  // Get writer's application IDs for filtering purchases
  const myApps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.writerId, session.user.id),
    columns: { id: true, title: true },
  });
  const myAppIds = myApps.map((a) => a.id);
  const myAppTitleMap = Object.fromEntries(myApps.map((a) => [a.id, a.title]));

  const [earnings, recentPayouts, recentSales] = await Promise.all([
    db.query.writerEarnings.findFirst({ where: eq(writerEarnings.writerId, session.user.id) }),
    db.query.payouts.findMany({
      where: eq(payouts.writerId, session.user.id),
      orderBy: [desc(payouts.requestedAt)],
      limit: 10,
    }),
    db.query.purchases
      .findMany({
        where: eq(purchases.status, "completed"),
        with: {
          essay: { columns: { title: true, writerId: true } },
          application: { columns: { id: true, writerId: true } },
        },
        orderBy: [desc(purchases.purchasedAt)],
        limit: 100,
      })
      .then((rows) =>
        rows
          .filter(
            (r) =>
              r.essay?.writerId === session.user.id ||
              (r.application?.writerId === session.user.id)
          )
          .slice(0, 20)
      ),
  ]);

  const availableCents = earnings?.availableCents ?? 0;
  const pendingCents = earnings?.pendingCents ?? 0;
  const totalEarnedCents = earnings?.totalEarnedCents ?? 0;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
        <p className="text-gray-500 text-sm mt-1">Your earnings and payout history</p>
      </div>

      {/* Stat Chips */}
      <section className="mb-6 flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-xs text-gray-500">Total Earned</span>
          <span className="text-sm font-semibold text-gray-900">{formatCents(totalEarnedCents)}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <DollarSign className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-xs text-gray-500">Balance</span>
          <span className="text-sm font-semibold text-gray-900">{formatCents(availableCents)}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-xs text-gray-500">Pending</span>
          <span className="text-sm font-semibold text-gray-900">{formatCents(pendingCents)}</span>
        </div>
      </section>

      {/* Payout Button */}
      <section className="mb-10">
        <PayoutButton availableCents={availableCents} />
      </section>

      {/* Recent Sales */}
      {recentSales.length > 0 && (
        <section className="mb-8">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Sales</h2>
          <div className="space-y-2">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{sale.essay?.title ?? (sale.application?.id ? myAppTitleMap[sale.application.id] : null) ?? "Application"}</p>
                  <p className="text-xs text-gray-400">{timeAgo(sale.purchasedAt)}</p>
                </div>
                <p className="text-sm font-semibold text-green-600">
                  +{formatCents(sale.writerPayoutCents)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payout History */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Payout History</h2>
        {recentPayouts.length === 0 ? (
          <p className="text-sm text-gray-400">No payouts yet.</p>
        ) : (
          <div className="space-y-2">
            {recentPayouts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{formatCents(p.amountCents)}</p>
                  <p className="text-xs text-gray-400">{timeAgo(p.requestedAt)}</p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PAYOUT_STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
