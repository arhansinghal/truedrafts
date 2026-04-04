import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { essays, purchases, universities } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { PaywallOverlay } from "@/components/essays/PaywallOverlay";
import { ViewTracker } from "@/components/essays/ViewTracker";
import { BookmarkButton } from "@/components/essays/BookmarkButton";
import { RatingWidget } from "@/components/essays/RatingWidget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Eye, ShoppingBag, Star, ArrowLeft, BookOpen } from "lucide-react";
import { essayTypeLabel, formatCents } from "@/lib/utils";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const essay = await db.query.essays.findFirst({
    where: eq(essays.slug, slug),
    with: { university: true },
  });
  if (!essay) return {};
  return {
    title: essay.title,
    description: essay.previewContent.slice(0, 160),
    openGraph: {
      title: `${essay.title} — ${essay.university?.name}`,
      description: essay.previewContent.slice(0, 160),
    },
  };
}

export default async function EssayDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const essay = await db.query.essays.findFirst({
    where: and(eq(essays.slug, slug), eq(essays.status, "approved")),
    with: {
      university: true,
      writer: { columns: { id: true, name: true, username: true, verifiedAdmit: true, bio: true } },
    },
  });

  if (!essay) notFound();

  const session = await auth.api.getSession({ headers: await headers() });

  let isPurchased = false;
  if (session) {
    const purchase = await db.query.purchases.findFirst({
      where: and(
        eq(purchases.buyerId, session.user.id),
        eq(purchases.essayId, essay.id),
        eq(purchases.status, "completed")
      ),
    });
    isPurchased = !!purchase || session.user.id === essay.writerId;
  }

  const stars = (essay.avgRating ?? 0) / 10;

  return (
    <>
      <ViewTracker essayId={essay.id} />

      <div className="min-h-screen bg-[#f8faff]">
        <div className="mx-auto max-w-3xl px-4 py-8">
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
                <p className="text-sm text-green-700">You now have full access to this essay.</p>
              </div>
            </div>
          )}

          {/* Header card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                {essay.university.logoUrl ? (
                  <Image
                    src={essay.university.logoUrl}
                    alt={essay.university.name}
                    width={36}
                    height={36}
                    className="rounded-sm object-contain"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-sm bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                    {essay.university.name[0]}
                  </div>
                )}
                <div>
                  <Link href={`/university/${essay.university.slug}`} className="text-sm font-medium text-gray-700 hover:text-[#0851A0]">
                    {essay.university.name}
                  </Link>
                  {essay.admittedYear && (
                    <p className="text-xs text-gray-400">Class of {essay.admittedYear}</p>
                  )}
                </div>
              </div>
              <Badge variant="secondary">{essayTypeLabel(essay.essayType)}</Badge>
            </div>

            <h1 className="font-serif text-2xl font-bold text-gray-900 leading-snug mb-3">
              {essay.title}
            </h1>

            {/* Stats + Bookmark */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" /> {essay.views} views
              </span>
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-4 w-4" /> {essay.purchases} purchases
              </span>
              {(essay.ratingCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {stars.toFixed(1)} ({essay.ratingCount} ratings)
                </span>
              )}
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" /> {essay.wordCount} words
              </span>
            </div>
              <BookmarkButton essayId={essay.id} isLoggedIn={!!session} />
            </div>

            {/* Tags */}
            {essay.tags && essay.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {essay.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Writer */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm mb-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-[#e8f1fa] flex items-center justify-center text-[#0851A0] font-bold text-lg">
              {essay.writer.name[0]}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/writers/${essay.writer.username ?? essay.writer.id}`}
                  className="font-medium text-gray-900 hover:text-[#0851A0]"
                >
                  {essay.writer.name}
                </Link>
                {essay.writer.verifiedAdmit && (
                  <CheckCircle className="h-4 w-4 text-[#0851A0]" aria-label="Verified Admit" />
                )}
              </div>
              {essay.writer.bio && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{essay.writer.bio}</p>
              )}
            </div>
            {!isPurchased && (
              <span className="text-lg font-bold text-[#0851A0] shrink-0">
                {formatCents(essay.priceCents)}
              </span>
            )}
          </div>

          {/* Essay content */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="font-serif text-base text-gray-800 leading-relaxed whitespace-pre-wrap">
              {isPurchased ? essay.fullContent : essay.previewContent}
            </div>

            {!isPurchased && (
              <PaywallOverlay
                essayId={essay.id}
                essaySlug={essay.slug}
                priceCents={essay.priceCents}
                uniName={essay.university.name}
                uniLogo={essay.university.logoUrl}
                isLoggedIn={!!session}
                isPurchased={false}
              />
            )}
          </div>

          {/* Post-purchase: Rating */}
          {isPurchased && session && session.user.id !== essay.writerId && (
            <RatingSection essayId={essay.id} />
          )}
        </div>
      </div>
    </>
  );
}

function RatingSection({ essayId }: { essayId: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">Rate this essay</p>
      <RatingWidget essayId={essayId} />
    </div>
  );
}
