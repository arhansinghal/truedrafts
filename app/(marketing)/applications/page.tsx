import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { collegeApplications, universities } from "@/lib/db/schema";
import { eq, desc, asc, and, inArray, sql } from "drizzle-orm";
import { FilterSidebar } from "@/components/essays/FilterSidebar";
import { EssaySearch } from "@/components/essays/EssaySearch";
import {
  ApplicationCard,
  type AppWithRelations,
} from "@/components/applications/ApplicationCard";
import { X, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import {
  rankApplicationsByRelevance,
  IVY_UNIVERSITY_SLUGS,
} from "@/lib/vibe-anthropic";
import { expandSearchTokens, buildFilterTokens } from "@/lib/search-tokens";
import { BundleHeroStrip } from "@/components/bundles/BundleHeroStrip";
import { getBundleMembershipMap } from "@/lib/bundles";

export const metadata: Metadata = {
  title: "Browse College Applications",
  description:
    "Browse full college applications from admitted students at Harvard, MIT, Stanford, and more.",
};

// Columns the list cards render. Critically EXCLUDES the heavyweight per-row
// columns — insightBriefEmbedding (1024-dim vector), commonAppContent,
// supplementals, vibeSearchText/vibeMetadata — whose transfer over the Neon
// WebSocket made this page take ~8s. Selecting only these takes ~1.9s.
const CARD_COLUMNS = {
  id: true,
  slug: true,
  title: true,
  major: true,
  tags: true,
  admittedYear: true,
  priceCents: true,
  views: true,
  purchases: true,
  submittedCommonApp: true,
  numSupplementals: true,
  insightBrief: true,
} as const;

const SORT_OPTIONS = {
  popular: desc(collegeApplications.views),
  trending: desc(collegeApplications.purchases),
  newest: desc(collegeApplications.publishedAt),
  top_rated: desc(collegeApplications.avgRating),
  price_asc: asc(collegeApplications.priceCents),
} as const;

function buildPaginationQuery(
  p: Record<string, string | undefined>,
  pageNum: number
): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== "") u.set(k, v);
  }
  u.set("page", String(pageNum));
  return `?${u.toString()}`;
}

/**
 * Build a text-match condition using ILIKE over a concatenated blob of all
 * searchable text. Each token is matched as a substring; any token matching
 * anywhere is a hit (OR semantics across tokens).
 *
 * Callers are expected to have already tokenized + synonym-expanded their
 * input via `expandSearchTokens` — this function does no further processing.
 */
function buildTextMatchCondition(tokens: string[]) {
  if (tokens.length === 0) return null;

  const haystack = sql`lower(
    coalesce(${collegeApplications.vibeSearchText}, '') || ' ' ||
    coalesce(${collegeApplications.title}, '') || ' ' ||
    coalesce(${collegeApplications.major}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppContent}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppPrompt}, '') || ' ' ||
    coalesce(${collegeApplications.supplementals}, '') || ' ' ||
    array_to_string(coalesce(${collegeApplications.tags}, '{}'::text[]), ' ')
  )`;

  const clauses = tokens.map((t) => sql`${haystack} LIKE ${"%" + t.toLowerCase() + "%"}`);
  return sql`(${sql.join(clauses, sql` OR `)})`;
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    university?: string;
    school_type?: string;
    page?: string;
    q?: string;
    vibe_q?: string;
    year?: string;
    vibe_tone?: string;
    vibe_themes?: string;
    detected_uni?: string;
    detected_uni_slug?: string;
    detected_major?: string;
    detected_years?: string;
    detected_state?: string;
    detected_region?: string;
    detected_type?: string;
    ivy?: string;
  }>;
}) {
  const params = await searchParams;
  const sort = (params.sort ?? "newest") as keyof typeof SORT_OPTIONS | "relevance";

  const orderByColumn =
    sort === "relevance"
      ? SORT_OPTIONS.newest
      : SORT_OPTIONS[sort as keyof typeof SORT_OPTIONS] ?? SORT_OPTIONS.newest;

  const uniSlug       = params.university;
  const detectedUniSlug = params.detected_uni_slug?.trim();
  const detectedUni   = params.detected_uni?.trim();
  const ivyOnly       = params.ivy === "1";
  const detectedMajor = params.detected_major?.trim();
  const detectedState = params.detected_state?.trim().toUpperCase();
  const detectedRegion = params.detected_region?.trim().toLowerCase();
  const vibeThemes    = params.vibe_themes
    ? params.vibe_themes.split(",").map((t) => t.trim()).filter(Boolean)
    : [];
  const searchQuery   = params.q?.trim();
  const rankQuery     = (params.vibe_q?.trim() || searchQuery || "").trim();
  const page          = Math.max(1, parseInt(params.page ?? "1"));
  const selectedYears = params.year
    ? params.year.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];
  const detectedYears = params.detected_years
    ? params.detected_years.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];
  const pageSize = 18;
  const offset   = (page - 1) * pageSize;

  const allUniversities = await db.query.universities.findMany({
    orderBy: [asc(universities.displayOrder)],
  });

  const ivyUniIds = allUniversities
    .filter((u) => (IVY_UNIVERSITY_SLUGS as readonly string[]).includes(u.slug))
    .map((u) => u.id);

  // ── Resolve target university (hard filter priority) ───────────────────────
  // Order: explicit sidebar pick > AI-resolved slug > AI raw-text fuzzy match.
  let uniId: string | undefined;
  if (uniSlug) {
    uniId = allUniversities.find((u) => u.slug === uniSlug)?.id;
  } else if (detectedUniSlug) {
    uniId = allUniversities.find((u) => u.slug === detectedUniSlug)?.id;
  } else if (detectedUni) {
    const q = detectedUni.toLowerCase();
    uniId = allUniversities.find(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.slug.toLowerCase().includes(q) ||
        u.aliases?.some((a) => a.toLowerCase().includes(q))
    )?.id;
  }

  // ── Location / ivy structured filter (only when no specific uni chosen) ────
  // These are hard filters when the query is unambiguous (e.g. "California
  // schools", "ivy league"). school_type is intentionally NOT a hard filter —
  // it's a soft vibe signal handled by the ranker.
  let structuredUniIds: string[] | undefined;
  if (!uniId) {
    if (ivyOnly) {
      structuredUniIds = ivyUniIds;
    } else if (detectedState) {
      structuredUniIds = allUniversities.filter((u) => u.state === detectedState).map((u) => u.id);
    } else if (detectedRegion) {
      structuredUniIds = allUniversities.filter((u) => u.region === detectedRegion).map((u) => u.id);
    }
  }

  // ── Build WHERE ─────────────────────────────────────────────────────────────
  const whereConditions = [eq(collegeApplications.status, "approved")];

  if (uniId) {
    whereConditions.push(eq(collegeApplications.universityId, uniId));
  } else if (structuredUniIds && structuredUniIds.length > 0) {
    // Only apply the structured filter when it actually resolves to some unis.
    // An empty result means we don't know — fall through to a broader search
    // rather than hard-failing with `1=0`.
    whereConditions.push(inArray(collegeApplications.universityId, structuredUniIds));
  }

  // ── Year filter (sidebar/AI) ────────────────────────────────────────────────
  let yearFilter: number[] | null = null;
  if (selectedYears.length > 0 && detectedYears.length > 0) {
    yearFilter = selectedYears.filter((y) => detectedYears.includes(y));
  } else if (selectedYears.length > 0) {
    yearFilter = selectedYears;
  } else if (detectedYears.length > 0) {
    yearFilter = detectedYears;
  }
  if (yearFilter !== null && yearFilter.length > 0) {
    whereConditions.push(inArray(collegeApplications.admittedYear, yearFilter));
  }

  // ── Text match (broad ILIKE across essay body + title + metadata) ──────────
  // Tokenize every input phrase to individual words, expand short-form
  // abbreviations (cs → computer_science, bio → biology, …), then strip any
  // token that already drives a structural filter (uni name / "ivy" / state
  // / region) so the text match doesn't pointlessly re-narrow results.
  const selectedUniForTokens = uniId
    ? allUniversities.find((x) => x.id === uniId)
    : undefined;
  const filterTokens = buildFilterTokens({
    uniName: selectedUniForTokens?.name,
    uniSlug: selectedUniForTokens?.slug,
    uniAliases: selectedUniForTokens?.aliases ?? undefined,
    ivy: ivyOnly,
    state: detectedState,
    region: detectedRegion,
  });

  // Pull tokens from every meaningful source. We deliberately DO NOT include
  // `semantic_keywords` (a.k.a. vibe_q) — the AI returns paraphrases like
  // "ivy league aspirations" that never substring-match an essay, so feeding
  // them through ILIKE zeroes out otherwise-valid queries.
  const rawTextPhrases = [
    ...vibeThemes,
    detectedMajor ?? "",
    searchQuery ?? "",
  ].filter(Boolean);

  const textTokens = expandSearchTokens(rawTextPhrases, filterTokens);
  const textCondition = buildTextMatchCondition(textTokens);
  if (textCondition) whereConditions.push(textCondition);

  // ── Execute query ───────────────────────────────────────────────────────────
  const useRelevance =
    sort === "relevance" &&
    rankQuery.length > 0 &&
    (!!process.env.DEEPSEEK_API_KEY || !!process.env.ANTHROPIC_API_KEY);

  let rows: AppWithRelations[];
  let totalRanked: number | null = null;

  if (useRelevance) {
    const pool = await db.query.collegeApplications.findMany({
      where: and(...whereConditions),
      // Card columns + vibeSearchText (the ranker reads it). Still excludes the
      // vector and full essay text.
      columns: { ...CARD_COLUMNS, vibeSearchText: true },
      with: {
        university: true,
        writer: {
          columns: { id: true, name: true, username: true, verifiedAdmit: true },
        },
      },
      limit: 180,
    });

    const rankedIds = await rankApplicationsByRelevance(
      rankQuery,
      pool.map((app) => ({
        id: app.id,
        title: app.title,
        vibeSearchText: app.vibeSearchText,
        major: app.major,
        universityName: app.university?.name ?? "",
        admittedYear: app.admittedYear,
      }))
    );

    totalRanked = rankedIds.length;
    const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
    const sorted = [...pool].sort(
      (a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999)
    );
    rows = sorted.slice(offset, offset + pageSize);
  } else {
    rows = await db.query.collegeApplications.findMany({
      where: and(...whereConditions),
      columns: CARD_COLUMNS,
      with: {
        university: true,
        writer: {
          columns: { id: true, name: true, username: true, verifiedAdmit: true },
        },
      },
      orderBy: [orderByColumn],
      limit: pageSize,
      offset,
    });
  }

  const selectedUni = uniSlug
    ? allUniversities.find((u) => u.slug === uniSlug)
    : null;

  const paginationBase: Record<string, string | undefined> = {
    sort: params.sort,
    university: params.university,
    school_type: params.school_type,
    q: params.q,
    vibe_q: params.vibe_q,
    year: params.year,
    vibe_tone: params.vibe_tone,
    vibe_themes: params.vibe_themes,
    detected_uni: params.detected_uni,
    detected_uni_slug: params.detected_uni_slug,
    detected_major: params.detected_major,
    detected_years: params.detected_years,
    detected_state: params.detected_state,
    detected_region: params.detected_region,
    detected_type: params.detected_type,
    ivy: params.ivy,
  };

  const hasNextPage = useRelevance
    ? totalRanked !== null && offset + pageSize < totalRanked
    : rows.length === pageSize;

  // Pre-resolve bundle membership for all visible cards in one pass to avoid
  // an N+1 of rule resolution from inside ApplicationCard.
  const bundleMembershipMap = await getBundleMembershipMap(rows.map((r) => r.id));

  return (
    <div className="min-h-screen bg-[#f8faff]">
      <div className="bg-white border-b border-gray-200 px-4 py-8">
        <div className="mx-auto max-w-7xl">
          {selectedUni && (
            <nav className="flex items-center gap-1 text-xs text-gray-400 mb-3">
              <Link
                href="/applications"
                className="hover:text-[#0851A0] transition-colors"
              >
                Applications
              </Link>
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
                    Search: &ldquo;{params.vibe_q?.trim() || searchQuery}&rdquo;
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
                  {selectedUni
                    ? `${selectedUni.name} Applications`
                    : "Browse Applications"}
                </h1>
              )}
              <p className="text-gray-500 text-sm mt-1">
                Full college applications from admitted students — essays, prompts,
                and more
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl flex justify-center">
          <Suspense
            fallback={
              <div className="w-full max-w-xl h-10 rounded-full bg-gray-100 animate-pulse" />
            }
          >
            <EssaySearch currentSearch={params.q} />
          </Suspense>
        </div>
      </div>

      <BundleHeroStrip />

      <div className="mx-auto max-w-7xl px-4 py-8 flex gap-8 items-start">
        <FilterSidebar
          universities={allUniversities}
          currentSort={sort === "relevance" ? "relevance" : sort}
          currentUniSlug={uniSlug}
          currentSearch={params.q}
          currentYear={params.year}
        />

        <div className="flex-1 min-w-0">
          {rows.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-gray-400 text-lg">No applications found.</p>
              <p className="text-gray-400 text-sm mt-1">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {rows.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    bundles={bundleMembershipMap.get(app.id)}
                  />
                ))}
              </div>

              {(hasNextPage || page > 1) && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  {page > 1 && (
                    <a
                      href={buildPaginationQuery(paginationBase, page - 1)}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      ← Previous
                    </a>
                  )}
                  <span className="text-sm text-gray-500">Page {page}</span>
                  {hasNextPage && (
                    <a
                      href={buildPaginationQuery(paginationBase, page + 1)}
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
