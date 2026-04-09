"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_ACTIONS = [
  { next: "processing", label: "Mark Processing", style: "border border-blue-200 text-blue-700 hover:bg-blue-50" },
  { next: "paid",       label: "Mark Paid",       style: "border border-green-200 text-green-700 hover:bg-green-50" },
  { next: "failed",     label: "Mark Failed",     style: "border border-red-200 text-red-700 hover:bg-red-50" },
] as const;

type Status = "pending" | "processing" | "paid" | "failed";

const ALLOWED_TRANSITIONS: Record<Status, readonly string[]> = {
  pending:    ["processing", "paid", "failed"],
  processing: ["paid", "failed"],
  paid:       [],
  failed:     [],
};

export function PayoutActions({ payoutId, currentStatus }: { payoutId: string; currentStatus: Status }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const allowed = ALLOWED_TRANSITIONS[currentStatus];

  if (allowed.length === 0) return <span className="text-xs text-gray-400">No actions</span>;

  async function update(next: string) {
    setLoading(next);
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Failed to update payout status.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      {STATUS_ACTIONS.filter((a) => allowed.includes(a.next)).map(({ next, label, style }) => (
        <button
          key={next}
          onClick={() => update(next)}
          disabled={!!loading}
          className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors disabled:opacity-50 ${style}`}
        >
          {loading === next ? "…" : label}
        </button>
      ))}
    </div>
  );
}
