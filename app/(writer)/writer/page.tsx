import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, writerEarnings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  PenLine,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  DollarSign,
  FileText,
} from "lucide-react";
import { formatCents, timeAgo } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Writer Dashboard" };

export default async function WriterOverviewPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  const [myApplications, earnings] = await Promise.all([
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, session.user.id),
      with: { university: true },
      orderBy: [desc(collegeApplications.createdAt)],
      limit: 5,
    }),
    db.query.writerEarnings.findFirst({
      where: eq(writerEarnings.writerId, session.user.id),
    }),
  ]);

  const totalApplications = myApplications.length;
  const totalSales = myApplications.reduce((s, a) => s + (a.purchases ?? 0), 0);

  const availableCents = earnings?.availableCents ?? 0;
  const totalEarnedCents = earnings?.totalEarnedCents ?? 0;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session.user.name.split(" ")[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s your overview</p>
      </div>

      {/* Stat Cards */}
      <section className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Earned */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-green-50">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </span>
            <span className="text-xs font-medium text-gray-500">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCents(totalEarnedCents)}</p>
        </div>

        {/* Available to Payout */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-50">
              <DollarSign className="h-4 w-4 text-[#0851A0]" />
            </span>
            <span className="text-xs font-medium text-gray-500">Available</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCents(availableCents)}</p>
          {availableCents >= 1000 && (
            <Link
              href="/writer/revenue"
              className="mt-2 inline-block text-xs font-medium text-[#0851A0] hover:underline"
            >
              Request Payout
            </Link>
          )}
        </div>

        {/* Total Applications */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
              <FileText className="h-4 w-4 text-gray-500" />
            </span>
            <span className="text-xs font-medium text-gray-500">Applications</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalApplications}</p>
        </div>

        {/* Total Sales */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
              <ShoppingBag className="h-4 w-4 text-gray-500" />
            </span>
            <span className="text-xs font-medium text-gray-500">Total Sales</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-8 flex items-center gap-3">
        <Link href="/writer/essays/new">
          <Button size="sm" className="rounded-full bg-[#0851A0] hover:bg-[#063d85] text-white text-xs px-4" style={{ background: "#0851A0" }}>
            Upload Application
          </Button>
        </Link>
        <Link href="/writer/buyers">
          <Button size="sm" variant="outline" className="rounded-full text-xs px-4">
            View Buyers
          </Button>
        </Link>
      </section>

      {/* Recent Applications */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Recent Applications</h2>
          <Link href="/writer/essays">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        {myApplications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <PenLine className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">
              No applications yet. Upload your first one to start earning.
            </p>
            <Link href="/writer/essays/new">
              <Button size="sm" className="gap-2 bg-[#0851A0] text-white" style={{ background: "#0851A0" }}>
                <PenLine className="h-4 w-4" /> Upload Application
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myApplications.map((app) => {
              const supplementals = (() => { try { return JSON.parse(app.supplementals ?? "[]"); } catch { return []; } })();
              const essayCount = (app.submittedCommonApp ? 1 : 0) + supplementals.length;
              const statusConfig = {
                pending:  { label: "Pending Approval", style: "bg-[#e8f1fa] text-[#0851A0] border-[#0851A0]/20", icon: Clock },
                approved: { label: "Live",             style: "bg-green-50 text-green-700 border-green-200",      icon: CheckCircle },
                rejected: { label: "Rejected",         style: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
                archived: { label: "Archived",         style: "bg-gray-100 text-gray-500 border-gray-200",        icon: FileText },
              }[app.status] ?? { label: "Pending", style: "bg-[#e8f1fa] text-[#0851A0] border-[#0851A0]/20", icon: Clock };
              const StatusIcon = statusConfig.icon;

              return (
                <div key={app.id} className="flex items-center gap-4 rounded-2xl bg-white border border-gray-100 shadow-sm p-5 transition-shadow hover:shadow-md">
                  <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                    <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={36} height={36} className="object-contain p-0.5" unoptimized />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{app.title}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig.style}`}>
                        <StatusIcon className="h-3 w-3" />{statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {essayCount} essay{essayCount !== 1 ? "s" : ""} · {timeAgo(app.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                    <span className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />{app.purchases ?? 0}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
