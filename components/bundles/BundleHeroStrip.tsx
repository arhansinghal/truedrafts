import Link from "next/link";
import { Sparkles, ChevronRight } from "lucide-react";
import { BundleCard } from "./BundleCard";
import {
  getActiveBundles,
  resolveBundleMembers,
  computeBundlePrice,
  type Bundle,
} from "@/lib/bundles";

/**
 * Server component. Renders the bundle strip at the top of the browse page.
 * Returns null when there are no active bundles so the strip doesn't reserve
 * empty space.
 */
export async function BundleHeroStrip() {
  const all = await getActiveBundles();
  if (all.length === 0) return null;

  const enriched = await Promise.all(
    all.map(async (b: Bundle) => {
      const members = await resolveBundleMembers(b);
      if (members.length === 0) return null;
      const pricing = computeBundlePrice(b, members);
      return { bundle: b, memberCount: members.length, pricing };
    }),
  );
  const cards = enriched.filter((x): x is NonNullable<typeof x> => x !== null);
  if (cards.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="rounded-2xl border border-blue-100 bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#0851A0] text-white flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h2 className="text-sm font-semibold text-gray-900">Bundle deals</h2>
            <span className="text-xs text-gray-500">— save when you buy multiple applications together</span>
          </div>
          {cards.length > 3 && (
            <Link
              href="/bundles"
              className="text-xs font-medium text-[#0851A0] hover:underline flex items-center gap-0.5"
            >
              See all <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.slice(0, 3).map((c) => (
            <BundleCard
              key={c.bundle.id}
              bundle={c.bundle}
              memberCount={c.memberCount}
              pricing={c.pricing}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
