import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { collegeApplications, purchases, writerEarnings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { ApplicationPaywall } from "@/components/applications/ApplicationPaywall";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Eye, ShoppingBag, ArrowLeft, FileText, Lock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string; checkout_id?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.slug, slug),
    with: { university: true },
  });
  if (!app) return {};
  return {
    title: app.title,
    description: `Full college application to ${app.university?.name}. Class of ${app.admittedYear ?? "recent year"}.`,
  };
}

export default async function ApplicationDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const [app, session] = await Promise.all([
    db.query.collegeApplications.findFirst({
      where: and(eq(collegeApplications.slug, slug), eq(collegeApplications.status, "approved")),
      with: {
        university: true,
        writer: { columns: { id: true, name: true, email: true, username: true, verifiedAdmit: true, bio: true } },
      },
    }),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!app) notFound();

  let isPurchased = false;
  if (session) {
    // Check DB first
    const existingPurchase = await db.query.purchases.findFirst({
      where: and(
        eq(purchases.buyerId, session.user.id),
        eq(purchases.applicationId, app.id),
        eq(purchases.status, "completed")
      ),
    });

    isPurchased = !!existingPurchase || session.user.id === app.writerId;

    // If DB has no record but Polar says payment succeeded, record it now.
    // This handles sandbox (no webhook) and production race conditions.
    if (!isPurchased && sp.purchased === "true" && sp.checkout_id) {
      try {
        const checkout = await polarClient.checkouts.get({ id: sp.checkout_id });
        const meta = checkout.metadata as Record<string, string> | null;
        if (
          checkout.status === "succeeded" &&
          meta?.application_id === app.id &&
          meta?.buyer_id === session.user.id
        ) {
          const amountCents = checkout.totalAmount || app.priceCents;
          const feeCents = Math.floor(amountCents * 0.5);
          const payoutCents = amountCents - feeCents;

          await db.insert(purchases).values({
            buyerId: session.user.id,
            applicationId: app.id,
            amountCents,
            platformFeeCents: feeCents,
            writerPayoutCents: payoutCents,
            polarOrderId: checkout.id,
            status: "completed",
          }).onConflictDoNothing();

          // Credit writer earnings
          await db.insert(writerEarnings).values({
            writerId: app.writerId,
            availableCents: payoutCents,
            totalEarnedCents: payoutCents,
          }).onConflictDoUpdate({
            target: writerEarnings.writerId,
            set: {
              availableCents: sql`${writerEarnings.availableCents} + ${payoutCents}`,
              totalEarnedCents: sql`${writerEarnings.totalEarnedCents} + ${payoutCents}`,
              updatedAt: new Date(),
            },
          });

          // Increment purchase count
          await db.update(collegeApplications)
            .set({ purchases: sql`${collegeApplications.purchases} + 1` })
            .where(eq(collegeApplications.id, app.id));

          isPurchased = true;
        }
      } catch {
        // Polar verification failed — leave isPurchased = false
      }
    }
  }

  let supplementals: { prompt?: string; content?: string }[] = [];
  try { supplementals = JSON.parse(app.supplementals ?? "[]"); } catch { supplementals = []; }
  const essayCount = (app.submittedCommonApp ? 1 : 0) + supplementals.length;

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back */}
        <Link href="/applications" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to applications
        </Link>

        {/* Purchase success banner */}
        {sp.purchased === "true" && (
          <div className="mb-6 rounded-xl bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-900">Purchase successful!</p>
              <p className="text-sm text-green-700">You now have full access to this application.</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left sidebar — metadata + writer card */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4 lg:sticky lg:top-24">
            {/* Header card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden bg-white shrink-0">
                  <Image
                    src={`/uni_logos/${app.university.slug}.png`}
                    alt={app.university.name}
                    width={36}
                    height={36}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">{app.university.name}</p>
                  {app.admittedYear && (
                    <p className="text-xs text-gray-400">Class of {app.admittedYear}</p>
                  )}
                </div>
              </div>

              <h1 className="font-serif text-xl font-bold text-gray-900 leading-snug mb-3">
                {app.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" /> {app.views}
                </span>
                <span className="flex items-center gap-1">
                  <ShoppingBag className="h-3.5 w-3.5" /> {app.purchases}
                </span>
                <Badge variant="secondary" className="flex items-center gap-1 ml-auto">
                  <FileText className="h-3 w-3" />
                  {essayCount} essay{essayCount !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Tags */}
              {(app.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(app.tags ?? []).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Writer card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              {isPurchased ? (
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#e8f1fa] flex items-center justify-center text-[#0851A0] font-bold text-lg shrink-0">
                    {app.writer.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">{app.writer.name}</span>
                      {app.writer.verifiedAdmit && (
                        <CheckCircle className="h-4 w-4 text-[#0851A0] shrink-0" aria-label="Verified Admit" />
                      )}
                    </div>
                    {app.writer.bio && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{app.writer.bio}</p>
                    )}
                    <p className="text-xs text-[#0851A0] mt-1">
                      <a href={`mailto:${app.writer.email}`} className="hover:underline break-all">{app.writer.email}</a>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-400 italic text-sm">Anonymous writer</p>
                    <p className="text-xs text-gray-400 mt-0.5">Revealed after purchase</p>
                  </div>
                </div>
              )}
            </div>

            {/* Price / unlock — shown only when not purchased */}
            {!isPurchased && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Lock className="h-4 w-4" />
                  <span>Full application locked</span>
                </div>
                <p className="text-2xl font-bold text-[#0851A0]">{formatCents(app.priceCents)}</p>
                <ApplicationPaywall
                  applicationId={app.id}
                  applicationSlug={app.slug}
                  priceCents={app.priceCents}
                  isLoggedIn={!!session}
                />
              </div>
            )}
          </div>

          {/* Right main area — essay content */}
          <div className="flex-1 min-w-0">
            {isPurchased ? (
              <div className="space-y-6">
                {/* Common App essay */}
                {app.submittedCommonApp && (
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-gray-900 mb-1">Common App Essay</h2>
                    {app.commonAppPrompt && (
                      <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-gray-200 pl-3">
                        {app.commonAppPrompt}
                      </p>
                    )}
                    <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {app.commonAppContent}
                    </p>
                    {app.commonAppScreenshotUrl && (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-400 mb-2">Common App Screenshot</p>
                        <img
                          src={app.commonAppScreenshotUrl}
                          alt="Common App screenshot"
                          className="max-w-full max-h-80 rounded-xl border border-gray-100 object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Supplementals */}
                {supplementals.map((s, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-gray-900 mb-1">
                      Supplemental Essay {i + 1}
                    </h2>
                    {s.prompt && (
                      <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-gray-200 pl-3">
                        {s.prompt}
                      </p>
                    )}
                    <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {s.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              /* Paywall preview — 20% of content visible, rest faded */
              <div className="space-y-6">
                {app.submittedCommonApp && app.commonAppContent && (() => {
                  const chars = app.commonAppContent!.length;
                  const previewEnd = Math.floor(chars * 0.2);
                  const preview = app.commonAppContent!.slice(0, previewEnd);
                  const rest = app.commonAppContent!.slice(previewEnd);
                  return (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                      <h2 className="font-semibold text-gray-900 mb-1">Common App Essay</h2>
                      {app.commonAppPrompt && (
                        <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-gray-200 pl-3">
                          {app.commonAppPrompt}
                        </p>
                      )}
                      <div className="relative">
                        <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{preview}</p>
                        <div className="relative select-none pointer-events-none">
                          <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap opacity-20 line-clamp-3">{rest}</p>
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm text-gray-400 border-t border-gray-100 pt-4">
                          <Lock className="h-4 w-4 shrink-0" />
                          <span>Unlock to read the full essay and all supplementals</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {supplementals.slice(0, 2).map((s, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-gray-900 mb-1">Supplemental Essay {i + 1}</h2>
                    {s.prompt && (
                      <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-gray-200 pl-3">
                        {s.prompt}
                      </p>
                    )}
                    <div className="relative select-none pointer-events-none">
                      <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap opacity-20 line-clamp-2">{s.content}</p>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white" />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>Locked — unlock to read</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
