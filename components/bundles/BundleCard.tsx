import Link from "next/link";
import { Package, Clock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { Bundle } from "@/lib/db/schema";

interface Props {
  bundle: Bundle;
  memberCount: number;
  pricing: { sumPrices: number; finalPrice: number; savings: number; savingsPercent: number };
}

export function BundleCard({ bundle, memberCount, pricing }: Props) {
  const expiringSoon =
    bundle.endsAt && new Date(bundle.endsAt).getTime() - Date.now() < 7 * 24 * 3600 * 1000;
  return (
    <Link
      href={`/bundles/${bundle.slug}`}
      className="group block rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f5f9ff] via-white to-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#0851A0] text-white flex items-center justify-center shrink-0">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0851A0]">
            Bundle · {memberCount} apps
          </span>
        </div>
        {pricing.savingsPercent > 0 && (
          <span className="rounded-full bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5">
            Save {pricing.savingsPercent}%
          </span>
        )}
      </div>

      <h3 className="font-semibold text-base text-gray-900 line-clamp-2 mb-1 group-hover:text-[#0851A0] transition-colors">
        {bundle.title}
      </h3>
      {bundle.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{bundle.description}</p>
      )}

      <div className="flex items-end justify-between border-t border-blue-50 pt-3 mt-3">
        <div>
          <div className="text-xs text-gray-400 line-through">{formatCents(pricing.sumPrices)}</div>
          <div className="text-lg font-bold text-[#0851A0]">{formatCents(pricing.finalPrice)}</div>
        </div>
        {expiringSoon && bundle.endsAt && (
          <div className="text-[11px] text-orange-600 font-medium flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Ends {new Date(bundle.endsAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}
