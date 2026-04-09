import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { payouts, writerEarnings, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatCents, timeAgo } from "@/lib/utils";
import { PayoutActions } from "@/components/admin/PayoutActions";
import { DollarSign, Clock, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payouts — Admin" };

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-yellow-50 text-yellow-700 border-yellow-200",
  processing: "bg-blue-50 text-blue-700 border-blue-200",
  paid:       "bg-green-50 text-green-700 border-green-200",
  failed:     "bg-red-50 text-red-700 border-red-200",
};

export default async function AdminPayoutsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const [allPayouts, allEarnings] = await Promise.all([
    db.query.payouts.findMany({
      with: { writer: { columns: { id: true, name: true, email: true } } },
      orderBy: [desc(payouts.requestedAt)],
    }),
    db.query.writerEarnings.findMany({
      with: { writer: { columns: { id: true, name: true, email: true } } },
      orderBy: [desc(writerEarnings.totalEarnedCents)],
    }),
  ]);

  // Summary stats
  const totalPendingCents = allPayouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((acc, p) => acc + p.amountCents, 0);
  const totalPaidCents = allPayouts
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + p.amountCents, 0);
  const pendingCount = allPayouts.filter((p) => p.status === "pending").length;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
        <p className="text-gray-500 text-sm mt-1">Manage writer payout requests and view earnings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <Clock className="h-5 w-5 text-yellow-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Awaiting Action</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <DollarSign className="h-5 w-5 text-blue-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatCents(totalPendingCents)}</p>
          <p className="text-xs text-gray-500 mt-0.5">In-Flight (Pending + Processing)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <TrendingUp className="h-5 w-5 text-green-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatCents(totalPaidCents)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Paid Out</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Payout requests */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payout Requests</h2>
          </div>
          {allPayouts.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No payout requests yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {allPayouts.map((p) => (
                <div key={p.id} className="px-5 py-4 flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#e8f1fa] flex items-center justify-center text-xs font-bold text-[#0851A0] shrink-0 mt-0.5">
                    {p.writer.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.writer.name}</p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{p.writer.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested {timeAgo(p.requestedAt)}
                      {p.paidAt ? ` · Paid ${timeAgo(p.paidAt)}` : ""}
                    </p>
                    <div className="mt-2">
                      <PayoutActions payoutId={p.id} currentStatus={p.status as "pending" | "processing" | "paid" | "failed"} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">{formatCents(p.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Writer earnings overview */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Writer Earnings</h2>
          </div>
          {allEarnings.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">No earnings data yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {allEarnings.map((e) => (
                <div key={e.writerId} className="px-5 py-3 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-[#e8f1fa] flex items-center justify-center text-xs font-bold text-[#0851A0] shrink-0">
                    {e.writer.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.writer.name}</p>
                    <p className="text-xs text-gray-400 truncate">{e.writer.email}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-sm font-semibold text-gray-900">{formatCents(e.totalEarnedCents)} total</p>
                    <p className="text-xs text-gray-500">
                      <span className="text-green-600">{formatCents(e.availableCents)} avail</span>
                      {e.pendingCents > 0 && (
                        <span className="text-yellow-600 ml-1">· {formatCents(e.pendingCents)} pending</span>
                      )}
                    </p>
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
