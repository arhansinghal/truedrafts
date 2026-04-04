import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { purchases, essays, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { AdminDisputeRow } from "@/components/admin/DisputeRow";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Disputes — Admin" };

export default async function AdminDisputesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "admin") redirect("/");

  // Show all completed purchases — admin can issue refunds on any
  const allPurchases = await db.query.purchases.findMany({
    with: {
      essay: { columns: { id: true, title: true, writerId: true } },
      buyer: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(purchases.purchasedAt)],
    limit: 50,
  });

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Disputes & Refunds</h1>
        <p className="text-gray-500 text-sm mt-1">Issue refunds for any purchase. Writer earnings are debited automatically.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Essay</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Buyer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {allPurchases.map((p) => (
              <AdminDisputeRow key={p.id} purchase={p} />
            ))}
          </tbody>
        </table>
        {allPurchases.length === 0 && (
          <div className="py-10 text-center text-gray-400 text-sm">No purchases yet.</div>
        )}
      </div>
    </div>
  );
}
