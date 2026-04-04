import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { purchases, users, essays } from "@/lib/db/schema";
import { eq, sql, count, sum, desc } from "drizzle-orm";
import { formatCents, timeAgo } from "@/lib/utils";
import { DollarSign, Users as UsersIcon, FileText, TrendingUp, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Overview" };

export default async function AdminOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const [revenueResult, usersResult, essaysResult, recentPurchases, pendingEssays] = await Promise.all([
    db.select({
      gmvCents: sum(purchases.amountCents),
      platformRevenueCents: sum(purchases.platformFeeCents),
      totalPurchases: count(purchases.id),
    }).from(purchases).where(eq(purchases.status, "completed")),

    db.select({
      totalReaders: sql<number>`count(*) filter (where role = 'reader')`,
      totalWriters: sql<number>`count(*) filter (where role = 'writer')`,
      newThisWeek: sql<number>`count(*) filter (where created_at > now() - interval '7 days')`,
    }).from(users),

    db.select({
      pendingReview: sql<number>`count(*) filter (where status = 'pending')`,
      live: sql<number>`count(*) filter (where status = 'approved')`,
      rejected: sql<number>`count(*) filter (where status = 'rejected')`,
    }).from(essays),

    db.query.purchases.findMany({
      with: {
        essay: { columns: { title: true } },
        buyer: { columns: { name: true } },
      },
      where: eq(purchases.status, "completed"),
      orderBy: [desc(purchases.purchasedAt)],
      limit: 5,
    }),

    db.query.essays.findMany({
      where: eq(essays.status, "pending"),
      with: { university: true, writer: { columns: { name: true } } },
      orderBy: (e, { asc }) => [asc(e.createdAt)],
      limit: 5,
    }),
  ]);

  const rev = revenueResult[0];
  const usr = usersResult[0];
  const ess = essaysResult[0];

  const stats = [
    {
      label: "GMV",
      value: formatCents(Number(rev?.gmvCents ?? 0)),
      sub: `${formatCents(Number(rev?.platformRevenueCents ?? 0))} platform revenue`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Purchases",
      value: String(rev?.totalPurchases ?? 0),
      sub: "All time",
      icon: TrendingUp,
      color: "text-[#0851A0]",
      bg: "bg-blue-50",
    },
    {
      label: "Total Users",
      value: String(Number(usr?.totalReaders ?? 0) + Number(usr?.totalWriters ?? 0)),
      sub: `${usr?.totalWriters ?? 0} writers · ${usr?.newThisWeek ?? 0} new this week`,
      icon: UsersIcon,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Live Essays",
      value: String(ess?.live ?? 0),
      sub: `${ess?.pendingReview ?? 0} pending review`,
      icon: FileText,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-500 text-sm mt-1">Real-time platform metrics</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending essays */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pending Review ({ess?.pendingReview ?? 0})
            </h2>
            <Link href="/admin/essays?status=pending" className="text-xs text-[#0851A0] hover:underline">
              View all →
            </Link>
          </div>
          {pendingEssays.length === 0 ? (
            <p className="text-sm text-gray-400">No essays pending review.</p>
          ) : (
            <div className="space-y-2">
              {pendingEssays.map((essay) => (
                <Link
                  key={essay.id}
                  href={`/admin/essays?highlight=${essay.id}`}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{essay.title}</p>
                    <p className="text-xs text-gray-400">{essay.university.name} · by {essay.writer.name}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{timeAgo(essay.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent purchases */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Recent Purchases
            </h2>
            <Link href="/admin/revenue" className="text-xs text-[#0851A0] hover:underline">
              View all →
            </Link>
          </div>
          {recentPurchases.length === 0 ? (
            <p className="text-sm text-gray-400">No purchases yet.</p>
          ) : (
            <div className="space-y-2">
              {recentPurchases.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.essay?.title ?? "Application"}</p>
                    <p className="text-xs text-gray-400">by {p.buyer.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-green-600">{formatCents(p.amountCents)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(p.purchasedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
