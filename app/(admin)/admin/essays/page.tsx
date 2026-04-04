import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { essays } from "@/lib/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { AdminEssayQueue } from "@/components/admin/EssayQueue";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Essays — Admin" };

export default async function AdminEssaysPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  const sp = await searchParams;
  const status = sp.status ?? "pending";

  const rows = await db.query.essays.findMany({
    where: status === "all"
      ? or(eq(essays.status, "pending"), eq(essays.status, "approved"), eq(essays.status, "rejected"))
      : eq(essays.status, status as never),
    with: {
      university: true,
      writer: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(essays.createdAt)],
    limit: 50,
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Essay Queue</h1>
        <p className="text-gray-500 text-sm mt-1">{rows.length} essay{rows.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {["pending", "approved", "rejected", "all"].map((s) => (
          <a
            key={s}
            href={`/admin/essays?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
              status === s
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <AdminEssayQueue essays={rows} />
    </div>
  );
}
