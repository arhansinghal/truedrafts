import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bundles — Admin" };

export default async function AdminBundlesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const rows = await db.select().from(bundles).orderBy(desc(bundles.createdAt));

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bundles</h1>
          <p className="text-gray-500 text-sm mt-1">
            {rows.length} bundle{rows.length !== 1 ? "s" : ""} — discounted packages of college applications
          </p>
        </div>
        <Link href="/admin/bundles/new">
          <Button>
            <Plus className="h-4 w-4" />
            New bundle
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-base font-semibold text-gray-700">No bundles yet</h2>
          <p className="mt-1 text-sm text-gray-500">
            Create a static bundle (hand-pick applications) or a rule bundle (e.g. all Ivies).
          </p>
          <Link href="/admin/bundles/new" className="mt-4 inline-block">
            <Button size="sm">Create your first bundle</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <Link
              key={b.id}
              href={`/admin/bundles/${b.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                        b.status === "published"
                          ? "bg-green-100 text-green-700"
                          : b.status === "draft"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {b.status}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-[#0851A0]">
                      {b.kind}
                    </span>
                    {b.endsAt && (
                      <span className="text-[10px] text-gray-500">
                        ends {new Date(b.endsAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 truncate">{b.title}</h3>
                  {b.description && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{b.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#0851A0]">
                    {b.pricingMode === "flat"
                      ? b.flatPriceCents != null
                        ? formatCents(b.flatPriceCents)
                        : "—"
                      : b.discountPercent != null
                      ? `${b.discountPercent}% off`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {b.kind === "static"
                      ? `${(b.applicationIds ?? []).length} apps`
                      : "rule-based"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
