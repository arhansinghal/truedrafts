"use client";

import { formatCents } from "@/lib/utils";
import { PayoutButton } from "./PayoutButton";

interface EarningsCardProps {
  availableCents: number;
  pendingCents: number;
  totalEarnedCents: number;
}

export function EarningsCard({
  availableCents,
  pendingCents,
  totalEarnedCents,
}: EarningsCardProps) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Total Earned</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCents(totalEarnedCents)}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">
            {formatCents(pendingCents)}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-2">Available</p>
          <p className="text-3xl font-bold text-green-600">
            {formatCents(availableCents)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <PayoutButton availableCents={availableCents} />
      </div>
    </div>
  );
}
