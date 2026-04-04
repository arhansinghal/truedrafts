"use client";
import { useState } from "react";
import { formatCents } from "@/lib/utils";

interface EarningsCardProps {
  availableCents: number;
  pendingCents: number;
  totalEarnedCents: number;
}

export function EarningsCard({ availableCents, pendingCents, totalEarnedCents }: EarningsCardProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function requestPayout() {
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const res = await fetch("/api/writer/payout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setMessage(data.error ?? "Payout failed");
      } else {
        setMessage(`✓ Payout of ${formatCents(availableCents)} requested! Arrives in 2-5 business days.`);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Total Earned</p>
          <p className="text-3xl font-bold text-gray-900">{formatCents(totalEarnedCents)}</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{formatCents(pendingCents)}</p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Available</p>
          <p className="text-3xl font-bold text-green-600">{formatCents(availableCents)}</p>
        </div>
      </div>

      <div className="mt-4">
        {availableCents >= 1000 ? (
          <button
            className="bg-[#0851A0] text-white rounded-xl py-3 px-6 font-semibold text-sm hover:bg-[#063d85] disabled:opacity-50 w-full mt-4"
            disabled={loading}
            onClick={requestPayout}
          >
            {loading ? "Processing..." : "Request Payout"}
          </button>
        ) : (
          <p className="text-sm text-gray-400 mt-4">Need $10 minimum to withdraw</p>
        )}
        {message && (
          <p className={`text-xs mt-2 ${isError ? "text-red-600" : "text-[#0851A0]"}`}>{message}</p>
        )}
      </div>
    </div>
  );
}
