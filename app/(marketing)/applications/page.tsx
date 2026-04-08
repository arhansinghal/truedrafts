import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { collegeApplications, universities } from "@/lib/db/schema";
import { eq, desc, asc, and, ilike, or, inArray } from "drizzle-orm";
import { FilterSidebar } from "@/components/essays/FilterSidebar";
import { EssaySearch } from "@/components/essays/EssaySearch";
import { ApplicationCard } from "@/components/applications/ApplicationCard";
import { X, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse College Applications",
  description: "Browse full college applications from admitted students at Harvard, MIT, Stanford, and more.",
};

const SORT_OPTIONS = {
  popular:   desc(collegeApplications.views),
  trending:  desc(collegeApplications.purchases),
  newest:    desc(collegeApplications.publishedAt),
  top_rated: desc(collegeApplications.avgRating),
  price_asc: asc(collegeApplications.priceCents),
} as const;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; university?: string; page?: string; q?: string; year?: string; vibe_tone?: string; vibe_themes?: string; detected_uni?: string }>;
}) {
  const params = await searchParams;
  const sort = (params.sort ?? "newest") as keyof typeof SORT_OPTIONS;
  const uniSlug = params.university;
  const detectedUni = params.detected_uni?.trim();
  const vibeThemes = params.vibe_themes ? params.vibe_themes.split(",").map(t => t.trim()).filter(Boolean) : [];
  const searchQuery = params.q?.trim();
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const selectedYears = params.year
    ? params.year.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];
  const pageSize = 18;
  const offset = (page - 1) * pageSize;

  const allUniversities = await db.query.universities.findMany({
    orderBy: [asc(universities.displayOrder)],
  });

  let uniId: string | undefined;
  if (uniSlug) {
    uniId = allUniversities.find((u) => u.slug === uniSlug)?.id;
  } else if (detectedUni) {
    // Fuzzy match: "Penn" → "University of Pennsylvania", "upenn", etc.
    const q = detectedUni.toLowerCase();
    uniId = allUniversities.find(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.slug.toLowerCase().includes(q) ||
        q.includes(u.slug.toLowerCase())
    )?.id;
  }

  const whereConditions = [eq(collegeApplications.status, "approved")];
  if (uniId) whereConditions.push(eq(collegeApplications.universityId, uniId));
  if (selectedYears.length > 0) {
    whereConditions.push(inArray(collegeApplications.admittedYear, selectedYears));
  }

  if (vibeThemes.length > 0) {
    // Search vibeSearchText (AI tags) AND title + content for each theme
    const themeConditions = vibeThemes.map((theme) =>
      or(
        ilike(collegeApplications.vibeSearchText, `%${theme}%`),
        ilike(collegeApplications.title, `%${theme}%`),
        ilike(collegeApplications.commonAppContent, `%${theme}%`),
        ilike(collegeApplications.supplementals, `%${theme}%`),
      )!
    );
    whereConditions.push(or(...themeConditions)!);
  } else if (searchQuery) {
    // Plain text fallback — search title + essay content
    whereConditions.push(
      or(
        ilike(collegeApplications.title, `%${searchQuery}%`),
        ilike(collegeApplications.commonAppContent, `%${searchQuery}%`),
        ilike(collegeApplications.supplementals, `%${searchQuery}%`),
        ilike(collegeApplications.vibeSearchText, `%${searchQuery}%`),
      )!
    );
  }

  // Fetch applications in parallel with universities (universities resolved above, used for filter only)
  const rows = await db.query.collegeApplications.findMany({
    where: and(...whereConditions),
    with: {
      university: true,
      writer: { columns: { id: true, name: true, username: true, verifiedAdmit: true } },
    },
    orderBy: [SORT_OPTIONS[sort] ?? SORT_OPTIONS.newest],
    limit: pageSize,
    offset,
  });

  const selectedUni = uniSlug ? allUniversities.find((u) => u.slug === uniSlug) : null;

  return (
    <div className="min-h-screen bg-[#f8faff]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {selectedUni && (
            <nav className="flex items-center gap-1 text-xs text-gray-400 mb-3">
              <Link href="/applications" className="hover:text-[#0851A0] transition-colors">Applications</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-gray-600 font-medium">{selectedUni.name}</span>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {selectedUni && (
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
                <Image
                  src={`/uni_logos/${selectedUni.slug}.png`}
                  alt={selectedUni.name}
                  width={32}
                  height={32}
                  className="object-contain p-0.5"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {searchQuery ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900">
                    Search: &ldquo;{searchQuery}&rdquo;
                  </h1>
                  <Link
                    href="/applications"
                    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
                  >
                    <X className="h-3 w-3" /> Clear
                  </Link>
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedUni ? `${selectedUni.name} Applications` : "Browse Applications"}
                </h1>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Full college applications from admitted students — essays, prompts, and more
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex justify-center">
          <Suspense fallback={<div className="w-full max-w-xl h-10 rounded-full bg-gray-100 animate-pulse" />}>
            <EssaySearch currentSearch={params.q} />
          </Suspense>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex gap-8 items-start">
        <FilterSidebar
          universities={allUniversities}
          currentSort={sort}
          currentUniSlug={uniSlug}
          currentSearch={params.q}
          currentYear={params.year}
        />

        <div className="flex-1 min-w-0">
          {rows.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-gray-400 text-lg">No applications found.</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {rows.map((app) => (
                  <ApplicationCard key={app.id} application={app} />
                ))}
              </div>

              {(rows.length === pageSize || page > 1) && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  {page > 1 && (
                    <a
                      href={`?sort=${sort}&university=${uniSlug ?? ""}&q=${params.q ?? ""}&page=${page - 1}`}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      ← Previous
                    </a>
                  )}
                  <span className="text-sm text-gray-500">Page {page}</span>
                  {rows.length === pageSize && (
                    <a
                      href={`?sort=${sort}&university=${uniSlug ?? ""}&q=${params.q ?? ""}&page=${page + 1}`}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Next →
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
