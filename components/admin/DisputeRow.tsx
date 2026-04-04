"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCents, timeAgo } from "@/lib/utils";
import type { Purchase, Essay, User } from "@/lib/db/schema";

type PurchaseWithRelations = Purchase & {
  essay: Pick<Essay, "id" | "title" | "writerId"> | null;
  buyer: Pick<User, "id" | "name" | "email">;
};

export function AdminDisputeRow({ purchase }: { purchase: PurchaseWithRelations }) {
  const [status, setStatus] = useState(purchase.status);
  const [loading, setLoading] = useState(false);

  async function issueRefund() {
    if (!confirm(`Refund ${formatCents(purchase.amountCents)} to ${purchase.buyer.name}?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/disputes/${purchase.id}/refund`, {
        method: "POST",
      });
      if (res.ok) setStatus("refunded");
    } finally {
      setLoading(false);
    }
  }

  return (
    <tr className={status === "refunded" ? "opacity-50" : "hover:bg-gray-50 transition-colors"}>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900 truncate max-w-[180px]">{purchase.essay?.title ?? "Application"}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-gray-900">{purchase.buyer.name}</p>
        <p className="text-xs text-gray-400">{purchase.buyer.email}</p>
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{formatCents(purchase.amountCents)}</p>
        <p className="text-xs text-gray-400">{timeAgo(purchase.purchasedAt)}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          status === "refunded" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>
          {status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {status === "completed" && (
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50"
            disabled={loading}
            onClick={issueRefund}
          >
            {loading ? "Processing..." : "Refund"}
          </Button>
        )}
      </td>
    </tr>
  );
}
