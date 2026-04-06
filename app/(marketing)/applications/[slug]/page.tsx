import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { collegeApplications, purchases, writerEarnings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { ApplicationPaywall } from "@/components/applications/ApplicationPaywall";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Eye, ShoppingBag, ArrowLeft, FileText, Lock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string; session_id?: string }>;
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

    // If DB has no record but Stripe says payment succeeded, record it now.
    // This handles race conditions where redirect fires before webhook.
    if (!isPurchased && sp.purchased === "true" && sp.session_id) {
      try {
        const stripeSession = await stripe.checkout.sessions.retrieve(sp.session_id);
        if (
          stripeSession.payment_status === "paid" &&
          stripeSession.metadata?.application_id === app.id &&
          stripeSession.metadata?.buyer_id === session.user.id
        ) {
          const amountCents = stripeSession.amount_total ?? app.priceCents;
          const feeCents = Math.floor(amountCents * 0.5);
          const payoutCents = amountCents - feeCents;

          await db.insert(purchases).values({
            buyerId: session.user.id,
            applicationId: app.id,
            amountCents,
            platformFeeCents: feeCents,
            writerPayoutCents: payoutCents,
            polarOrderId: stripeSession.id,
            status: "completed",
          }).onConflictDoNothing();

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

          await db.update(collegeApplications)
            .set({ purchases: sql`${collegeApplications.purchases} + 1` })
            .where(eq(collegeApplications.id, app.id));

          isPurchased = true;
        }
      } catch {
        // Stripe verification failed — leave isPurchased = false
      }
    }
  }

  let supplementals: { prompt?: string; content?: string }[] = [];
  try { supplementals = JSON.parse(app.supplementals ?? "[]"); } catch { supplementals = []; }
  const essayCount = (app.submittedCommonApp ? 1 : 0) + supplementals.length;

  // Watermark SVG: diagonal repeating text with buyer email
  const watermarkSvg = isPurchased && session
    ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='340' height='160'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' transform='rotate(-25, 170, 80)' font-size='13' font-family='sans-serif' fill='rgba(8,81,160,0.07)' font-weight='600'>${session.user.email}</text></svg>`)}")`
    : undefined;

  function EssayBlock({
    title, prompt, content, isPurchased: purchased, lockLabel,
  }: { title: string; prompt?: string; content: string; isPurchased: boolean; lockLabel: string }) {
    if (!content) return null;
    const cutoff = Math.floor(content.length * 0.2);
    const visible = content.slice(0, cutoff);
    const hidden = content.slice(cutoff);
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm overflow-hidden">
        <h2 className="font-semibold text-gray-900 mb-1">{title}</h2>
        {prompt && (
          <p className="text-sm text-gray-500 italic mb-4 leading-relaxed border-l-2 border-gray-200 pl-3">
            {prompt}
          </p>
        )}
        {purchased ? (
          <div
            className="relative essay-protected"
            style={{ backgroundImage: watermarkSvg, backgroundRepeat: "repeat" }}
          >
            <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        ) : (
          <>
            <p className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{visible}</p>
            <div className="relative">
              <p className="font-serif text-base text-gray-700 leading-relaxed whitespace-pre-wrap select-none pointer-events-none">{hidden}</p>
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 0%, white 50%)" }} />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400 border-t border-gray-100 pt-4 mt-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>{lockLabel}</span>
            </div>
          </>
        )}
      </div>
    );
  }

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
            <div className="space-y-6">
              {/* Common App essay */}
              {app.submittedCommonApp && (
                <EssayBlock
                  title="Common App Essay"
                  prompt={app.commonAppPrompt ?? undefined}
                  content={app.commonAppContent ?? ""}
                  isPurchased={isPurchased}
                  lockLabel="Unlock to read the full essay and all supplementals"
                />
              )}
              {/* Supplementals */}
              {supplementals.map((s, i) => (
                <EssayBlock
                  key={i}
                  title={`Supplemental Essay ${i + 1}`}
                  prompt={s.prompt}
                  content={s.content ?? ""}
                  isPurchased={isPurchased}
                  lockLabel="Locked — unlock to read"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
