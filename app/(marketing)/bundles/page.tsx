import {
  getActiveBundles,
  resolveBundleMembers,
  computeBundlePrice,
} from "@/lib/bundles";
import { BundleCard } from "@/components/bundles/BundleCard";
import { Package } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bundle Deals — TrueDrafts",
  description: "Save when you buy multiple college applications together.",
};

export default async function BundlesIndexPage() {
  const all = await getActiveBundles();

  const enriched = await Promise.all(
    all.map(async (b) => {
      const members = await resolveBundleMembers(b);
      if (members.length === 0) return null;
      const pricing = computeBundlePrice(b, members);
      return { bundle: b, memberCount: members.length, pricing };
    }),
  );
  const cards = enriched.filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <div className="bg-white border-b border-gray-200 px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-[#0851A0] text-white flex items-center justify-center shrink-0">
              <Package className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Bundle deals</h1>
          </div>
          <p className="text-gray-500 text-sm max-w-2xl">
            Curated packages of full college applications from admitted students. Save when you
            unlock several at once. All sales are final.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {cards.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-gray-300" />
            <h2 className="mt-4 text-base font-semibold text-gray-700">No active bundles</h2>
            <p className="mt-1 text-sm text-gray-500">Check back soon for new deals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {cards.map((c) => (
              <BundleCard
                key={c.bundle.id}
                bundle={c.bundle}
                memberCount={c.memberCount}
                pricing={c.pricing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
