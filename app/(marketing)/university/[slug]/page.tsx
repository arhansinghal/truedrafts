import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { essays, universities } from "@/lib/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { EssayCard } from "@/components/essays/EssayCard";
import { EssayFilters } from "@/components/essays/EssayFilters";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; type?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const uni = await db.query.universities.findFirst({ where: eq(universities.slug, slug) });
  if (!uni) return {};
  return {
    title: `${uni.name} College Essays`,
    description: `Browse successful college application essays from students admitted to ${uni.name}.`,
  };
}

function getSortOrder(sort: string) {
  switch (sort) {
    case "popular": return [desc(essays.views)];
    case "trending": return [desc(essays.purchases)];
    case "top_rated": return [desc(essays.avgRating)];
    case "price_asc": return [asc(essays.priceCents)];
    default: return [desc(essays.publishedAt)];
  }
}

export default async function UniversityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const sort = sp.sort ?? "newest";
  const essayType = sp.type;

  const uni = await db.query.universities.findFirst({
    where: eq(universities.slug, slug),
  });
  if (!uni) notFound();

  const allUniversities = await db.query.universities.findMany();

  const whereConditions = [
    eq(essays.status, "approved"),
    eq(essays.universityId, uni.id),
  ];
  if (essayType) whereConditions.push(eq(essays.essayType, essayType as never));

  const rows = await db.query.essays.findMany({
    where: and(...whereConditions),
    with: {
      university: true,
      writer: { columns: { id: true, name: true, username: true, verifiedAdmit: true } },
    },
    orderBy: getSortOrder(sort),
    limit: 30,
  });

  const localLogo = `/uni_logos/${uni.slug}.png`;

  return (
    <div className="min-h-screen bg-[#f8faff]">
      {/* Hero */}
      <div className="bg-white border-b border-gray-100 px-4 py-10">
        <div className="mx-auto max-w-7xl flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
            <Image
              src={localLogo}
              alt={uni.name}
              width={52}
              height={52}
              className="object-contain p-1"
              unoptimized
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif">{uni.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {rows.length} essay{rows.length !== 1 ? "s" : ""} from verified admits
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <EssayFilters
          universities={allUniversities}
          currentSort={sort}
          currentUniSlug={slug}
          currentType={essayType}
        />

        {rows.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-gray-400 text-lg">No essays for {uni.name} yet.</p>
            <p className="text-gray-400 text-sm mt-1">Check back soon or browse other schools.</p>
            <Link href="/applications" className="mt-4 inline-block text-sm text-[#0851A0] hover:underline">
              Browse all applications →
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map((essay) => (
              <EssayCard key={essay.id} essay={essay} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
