"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { essayTypeLabel } from "@/lib/utils";
import type { University } from "@/lib/db/schema";
import { ChevronDown, Search } from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "trending", label: "Most Purchased" },
  { value: "popular", label: "Most Viewed" },
  { value: "top_rated", label: "Top Rated" },
  { value: "price_asc", label: "Price: Low to High" },
];

const ESSAY_TYPES = [
  "common_app",
  "supplemental",
  "why_school",
  "activities",
  "short_answer",
  "other",
];

interface EssayFiltersProps {
  universities: University[];
  currentSort?: string;
  currentUniSlug?: string;
  currentType?: string;
  currentSearch?: string;
}

const selectClass =
  "appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0851A0] cursor-pointer min-w-[140px]";

export function EssayFilters({
  universities,
  currentSort = "newest",
  currentUniSlug,
  currentType,
  currentSearch,
}: EssayFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(currentSearch ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      sort: currentSort,
      university: currentUniSlug,
      type: currentType,
      q: currentSearch,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      navigate({ q: value || undefined, page: undefined });
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters =
    (currentSort && currentSort !== "newest") || !!currentUniSlug || !!currentType;

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* University logo strip */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => navigate({ university: undefined, page: undefined })}
          className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium border transition-all ${
            !currentUniSlug
              ? "bg-[#0851A0] text-white border-[#0851A0] shadow-sm"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          All Schools
        </button>
        {universities.map((uni) => (
          <button
            key={uni.id}
            onClick={() => navigate({ university: uni.slug, page: undefined })}
            className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-all ${
              currentUniSlug === uni.slug
                ? "bg-[#e8f1fa] text-[#0851A0] border-[#0851A0]/30 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
            title={uni.name}
          >
            <div className="w-4 h-4 rounded overflow-hidden shrink-0 flex items-center justify-center bg-white">
              <Image
                src={`/uni_logos/${uni.slug}.png`}
                alt={uni.name}
                width={16}
                height={16}
                className="object-contain"
                unoptimized
              />
            </div>
            <span className="max-w-[80px] truncate">{uni.name}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-[320px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search essays by title or content…"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
        />
      </div>

      {/* Dropdowns row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <div className="relative">
          <select
            value={currentSort}
            onChange={(e) => navigate({ sort: e.target.value, page: undefined })}
            className={selectClass}
            aria-label="Sort essays"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Essay type */}
        <div className="relative">
          <select
            value={currentType ?? ""}
            onChange={(e) =>
              navigate({ type: e.target.value || undefined, page: undefined })
            }
            className={selectClass}
            aria-label="Filter by essay type"
          >
            <option value="">All Types</option>
            {ESSAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {essayTypeLabel(t)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() =>
              navigate({ sort: "newest", university: undefined, type: undefined, page: undefined })
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
