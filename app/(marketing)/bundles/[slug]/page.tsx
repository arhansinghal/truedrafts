import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  bundles as bundlesTable,
  bundlePurchases,
  collegeApplications,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import {
  resolveBundleMembers,
  computeBundlePrice,
  checkBuyerOverlap,
  bundleAvailability,
} from "@/lib/bundles";
import { BundleCheckoutButton } from "@/components/bundles/BundleCheckoutButton";
import { parseInsightBrief } from "@/components/applications/InsightPreview";
import { formatCents } from "@/lib/utils";
import {
  Package,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await db.query.bundles.findFirst({
    where: eq(bundlesTable.slug, slug),
  });
  if (!bundle) return {};
  return {
    title: `${bundle.title} — TrueDrafts Bundle`,
    description: bundle.description ?? `Bundle of college applications: ${bundle.title}`,
  };
}

export default async function BundleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const bundle = await db.query.bundles.findFirst({
    where: eq(bundlesTable.slug, slug),
  });
  if (!bundle) notFound();
  if (bundle.status === "draft") notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  const members = await resolveBundleMembers(bundle);
  const pricing = computeBundlePrice(bundle, members);

  // If logged in, check overlap so we can disable the CTA cleanly.
  let overlap: string[] = [];
  let alreadyBought = false;
  if (session) {
    overlap = await checkBuyerOverlap(session.user.id, members.map((m) => m.id));
    const existing = await db.query.bundlePurchases.findFirst({
      where: and(
        eq(bundlePurchases.buyerId, session.user.id),
        eq(bundlePurchases.bundleId, bundle.id),
      ),
    });
    alreadyBought = !!existing;
  }

  const status = bundleAvailability(bundle, members.length, overlap.length);
  const memberApps = members;

  const ctaDisabled = alreadyBought || status !== "available";
  const ctaReason = alreadyBought
    ? "Already unlocked"
    : status === "owns_some"
    ? "You already own one or more apps in this bundle"
    : status === "expired"
    ? "Bundle expired"
    : status === "not_started"
    ? "Bundle not yet available"
    : status === "empty"
    ? "Bundle has no available applications"
    : status === "archived"
    ? "Bundle archived"
    : undefined;

  // For each member, fetch its insight brief preview (already on the row).
  const memberRows = await db.query.collegeApplications.findMany({
    where: inArray(collegeApplications.id, memberApps.map((m) => m.id)),
    with: { university: true },
  });

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Link
          href="/bundles"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to bundles
        </Link>

        {sp.purchased === "true" && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-900">Bundle unlocked!</p>
              <p className="text-sm text-green-700">
                Every application in this bundle is now in your library.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0 space-y-4 lg:sticky lg:top-24">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f5f9ff] to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-[#0851A0] text-white flex items-center justify-center">
                  <Package className="h-4 w-4" />
                </div>
                <span className="text-xs font-semibold uppercase text-[#0851A0]">Bundle</span>
              </div>
              <h1 className="font-serif text-xl font-bold text-gray-900 leading-snug mb-2">
                {bundle.title}
              </h1>
              {bundle.description && (
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{bundle.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-gray-500">
                  <span>Applications included</span>
                  <span className="font-semibold text-gray-900">{memberApps.length}</span>
                </div>
                <div className="flex items-center justify-between text-gray-500">
                  <span>Sum of prices</span>
                  <span className="line-through">{formatCents(pricing.sumPrices)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                  <span className="text-sm text-gray-700 font-medium">Bundle price</span>
                  <span className="text-2xl font-bold text-[#0851A0]">
                    {formatCents(pricing.finalPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-green-700 font-medium">
                  <span>Save</span>
                  <span>
                    {formatCents(pricing.savings)} ({pricing.savingsPercent}%)
                  </span>
                </div>
                {bundle.endsAt && (
                  <div className="flex items-center gap-1.5 text-[11px] text-orange-600 font-medium pt-2">
                    <Clock className="h-3 w-3" />
                    Ends {new Date(bundle.endsAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="mt-4">
                {alreadyBought ? (
                  <div className="rounded-md border border-green-200 bg-green-50 p-2.5 text-xs text-green-700 flex items-start gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>You already own this bundle — find it in your library.</span>
                  </div>
                ) : (
                  <BundleCheckoutButton
                    bundleId={bundle.id}
                    bundleSlug={bundle.slug}
                    isLoggedIn={!!session}
                    disabled={ctaDisabled}
                    disabledReason={ctaReason}
                  />
                )}
              </div>
            </div>

            {overlap.length > 0 && !alreadyBought && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 flex items-start gap-2">
                <XCircle className="h-4 w-4 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-xs text-orange-800 leading-relaxed">
                  <p className="font-semibold">You already own {overlap.length} app{overlap.length !== 1 ? "s" : ""} in this bundle.</p>
                  <p className="text-orange-700 mt-0.5">
                    Bundles can't be re-bought when there's overlap. Buy any missing apps individually instead.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Main: members list */}
          <div className="flex-1 min-w-0 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              {memberApps.length} applications in this bundle
            </h2>
            {memberRows.map((app) => {
              const brief = parseInsightBrief(app.insightBrief);
              const summary = brief?.common_app?.summary?.trim();
              return (
                <Link
                  key={app.id}
                  href={`/applications/${app.slug}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 bg-white">
                      <Image
                        src={`/uni_logos/${app.university.slug}.png`}
                        alt={app.university.name}
                        width={36}
                        height={36}
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="text-xs text-gray-500 truncate">
                          {app.university.name} · Class of {app.admittedYear ?? "—"}
                        </span>
                        <span className="text-xs font-medium text-gray-400 line-through shrink-0">
                          {formatCents(app.priceCents)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{app.title}</h3>
                      {summary && (
                        <div className="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2 mt-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles className="h-3 w-3 text-[#0851A0]" />
                            <span className="text-[10px] font-semibold text-[#0851A0] uppercase tracking-wide">
                              AI summary
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 leading-snug line-clamp-3">{summary}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

            <div className="rounded-xl border border-gray-200 bg-white p-4 mt-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="text-xs text-gray-500 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-1">Buying a bundle</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>One Razorpay checkout, one charge.</li>
                  <li>Lifetime access to every application listed above — even if writers later unpublish.</li>
                  <li>All sales are final. No refunds.</li>
                  <li>If you already own one of these applications, the bundle can't be purchased.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
