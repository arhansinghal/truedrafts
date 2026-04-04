import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchases } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { BookOpen, ShoppingBag, ArrowRight, CheckCircle, FileText } from "lucide-react";
import { formatCents, timeAgo } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Library" };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/dashboard");

  const myPurchases = await db.query.purchases.findMany({
    where: and(eq(purchases.buyerId, session.user.id), eq(purchases.status, "completed")),
    with: {
      application: {
        with: {
          university: true,
          writer: { columns: { id: true, name: true, email: true, verifiedAdmit: true } },
        },
      },
    },
    orderBy: [desc(purchases.purchasedAt)],
  });

  const appPurchases = myPurchases.filter((p) => p.application !== null);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Library</h1>
        <p className="text-gray-500 text-sm mt-1">
          Welcome back, {session.user.name} · {appPurchases.length} application{appPurchases.length !== 1 ? "s" : ""} unlocked
        </p>
      </div>

      {appPurchases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-700 mb-2">No purchases yet</h3>
          <p className="text-sm text-gray-400 mb-5">Browse applications from admitted students to get started.</p>
          <Link href="/applications">
            <Button className="gap-2">Browse Applications <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {appPurchases.map((purchase) => {
            const app = purchase.application!;
            let suppCount = 0;
            try { suppCount = JSON.parse(app.supplementals ?? "[]").length; } catch { suppCount = 0; }
            const essayCount = (app.submittedCommonApp ? 1 : 0) + suppCount;
            return (
              <Link
                key={purchase.id}
                href={`/applications/${app.slug}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                {/* University logo */}
                <div className="h-9 w-9 rounded-lg bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                  <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={30} height={30} className="object-contain p-0.5" unoptimized />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-medium text-gray-900 truncate">{app.title}</p>
                    <span className="shrink-0 bg-blue-50 text-[#0851A0] text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FileText className="h-3 w-3" />{essayCount} essay{essayCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {app.university.name}{app.admittedYear ? ` · Class of ${app.admittedYear}` : ""}
                    {app.writer.verifiedAdmit && <CheckCircle className="inline h-3 w-3 text-[#0851A0] ml-1" />}
                  </p>
                  {/* Writer revealed after purchase */}
                  <p className="text-xs text-gray-700 mt-0.5">
                    Writer: <span className="font-medium">{app.writer.name}</span>
                    {" · "}<a href={`mailto:${app.writer.email}`} className="text-[#0851A0] hover:underline">{app.writer.email}</a>
                  </p>
                </div>

                {/* Right side */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1 justify-end">
                    <ShoppingBag className="h-3 w-3" /> Unlocked
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(purchase.purchasedAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
