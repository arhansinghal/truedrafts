"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import type { University } from "@/lib/db/schema";

const TRENDING_UNI_SLUGS = ["harvard", "stanford", "mit", "yale", "princeton"];
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020];

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest" },
  { value: "trending",  label: "Most Purchased" },
  { value: "popular",   label: "Most Viewed" },
  { value: "top_rated", label: "Top Rated" },
  { value: "price_asc", label: "Price: Low → High" },
];

interface Props {
  universities: University[];
  currentSort?: string;
  currentUniSlug?: string;
  currentType?: string;
  currentSearch?: string;
  currentYear?: string;
}

/* ── Hand-drawn X checkbox ─────────────────────────────────────────────── */
function HandCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button onClick={onChange} className="flex items-center gap-2.5 group text-left w-full py-1" aria-pressed={checked}>
      <span className="relative w-5 h-5 shrink-0 border-2 rounded transition-all duration-200"
        style={{ borderColor: checked ? "#0851A0" : "#d1d5db", background: checked ? "#e8f1fa" : "transparent" }}>
        {checked && (
          <svg viewBox="0 0 16 16" fill="none" className="absolute inset-0.5 w-3.5 h-3.5">
            <path d="M3,3 Q5,6 13,13" stroke="#0851A0" strokeWidth="2" strokeLinecap="round"/>
            <path d="M13,3 Q11,6 3,13" stroke="#0851A0" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </span>
      <span className={`text-sm transition-colors duration-200 ${checked ? "text-[#0851A0] font-medium" : "text-gray-600 group-hover:text-gray-900"}`}>
        {label}
      </span>
    </button>
  );
}

/* ── Ghost search with dropdown ─────────────────────────────────────────── */
function GhostSearch({
  value, onChange, onSelect, placeholder, options, renderOption,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (slug: string) => void;
  placeholder: string;
  options: { slug: string; name: string }[];
  renderOption?: (o: { slug: string; name: string }) => React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = value.length > 0
    ? options.filter((o) => o.name.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
    : options.slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        className="w-full bg-transparent border-0 border-b text-sm text-gray-700 placeholder-gray-300 py-1.5 focus:outline-none transition-all duration-200"
        style={{ borderColor: focused ? "#0851A0" : "#e5e7eb", borderBottomWidth: focused ? "2px" : "1px" }}
      />
      {focused && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(8,81,160,0.08)",
          }}>
          {filtered.map((opt) => (
            <button
              key={opt.slug}
              onMouseDown={() => { onSelect(opt.slug); onChange(""); setFocused(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[#e8f1fa] text-left text-sm text-gray-700 transition-colors"
            >
              {renderOption ? renderOption(opt) : opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Pill chip ──────────────────────────────────────────────────────────── */
function Pill({ label, logo, onRemove }: { label: string; logo?: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-[#e8f1fa] text-[#0851A0] text-xs font-medium rounded-full px-2.5 py-1 border border-[#9dc3e6]/40">
      {logo && (
        <span className="w-4 h-4 rounded overflow-hidden bg-white border border-gray-100 flex items-center justify-center shrink-0">
          <Image src={logo} alt="" width={14} height={14} className="object-contain" unoptimized/>
        </span>
      )}
      {label}
      <button onClick={onRemove} className="ml-0.5 text-[#0851A0]/60 hover:text-[#0851A0] leading-none text-sm">×</button>
    </span>
  );
}

/* ── Section header ─────────────────────────────────────────────────────── */
function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="font-hand text-base font-bold text-gray-800 tracking-wide">{children}</span>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(to right, rgba(8,81,160,0.15), transparent)" }}/>
    </div>
  );
}

/* ── Main sidebar ───────────────────────────────────────────────────────── */
export function FilterSidebar({
  universities,
  currentSort = "newest",
  currentUniSlug,
  currentSearch,
  currentYear,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [uniSearch, setUniSearch] = useState("");
  const [selectedYears, setSelectedYears] = useState<number[]>(
    currentYear ? currentYear.split(",").map(Number).filter(Boolean) : []
  );

  const navigate = useCallback((overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      sort: currentSort,
      university: currentUniSlug,
      q: currentSearch,
      year: currentYear,
      ...overrides,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, currentSort, currentUniSlug, currentSearch, currentYear]);

  function toggleYear(y: number) {
    const next = selectedYears.includes(y)
      ? selectedYears.filter((x) => x !== y)
      : [...selectedYears, y];
    setSelectedYears(next);
    navigate({ year: next.length ? next.join(",") : undefined });
  }

  const trendingUnis = universities.filter((u) => TRENDING_UNI_SLUGS.includes(u.slug));
  const allUniOptions = universities.map((u) => ({ slug: u.slug, name: u.name }));
  const currentUni = universities.find((u) => u.slug === currentUniSlug);

  return (
    <div
      className="w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-hide"
      style={{
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: "1.25rem",
        border: "1px solid rgba(255,255,255,0.8)",
        boxShadow: "0 4px 24px rgba(8,81,160,0.07), 0 0 0 1px rgba(8,81,160,0.05)",
        padding: "1.25rem",
      }}
    >
      {/* Sort */}
      <div className="mb-6">
        <SectionHead>Sort by</SectionHead>
        <div className="flex flex-col gap-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => navigate({ sort: opt.value, page: undefined })}
              className={`text-sm text-left px-2 py-1.5 rounded-lg transition-all duration-150 ${
                currentSort === opt.value
                  ? "bg-[#e8f1fa] text-[#0851A0] font-medium"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* University */}
      <div className="mb-6">
        <SectionHead>University</SectionHead>

        {/* Active selection pill — with logo */}
        {currentUni && (
          <div className="mb-2">
            <Pill
              label={currentUni.name}
              logo={`/uni_logos/${currentUni.slug}.png`}
              onRemove={() => navigate({ university: undefined, page: undefined })}
            />
          </div>
        )}

        <GhostSearch
          value={uniSearch}
          onChange={setUniSearch}
          onSelect={(slug) => navigate({ university: slug, page: undefined })}
          placeholder="Search universities…"
          options={allUniOptions}
          renderOption={(opt) => (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 rounded overflow-hidden bg-white border border-gray-100 flex items-center justify-center shrink-0">
                <Image src={`/uni_logos/${opt.slug}.png`} alt={opt.name} width={16} height={16} className="object-contain" unoptimized/>
              </div>
              {opt.name}
            </span>
          )}
        />

        {/* Trending quick-picks */}
        {!currentUniSlug && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-semibold">Trending</p>
            <div className="flex flex-col gap-1">
              {trendingUnis.map((u) => (
                <button
                  key={u.slug}
                  onClick={() => navigate({ university: u.slug, page: undefined })}
                  className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#0851A0] transition-colors group text-left"
                >
                  <div className="w-5 h-5 rounded overflow-hidden bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    <Image src={`/uni_logos/${u.slug}.png`} alt={u.name} width={14} height={14} className="object-contain grayscale group-hover:grayscale-0 transition-all" unoptimized/>
                  </div>
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Admission Year */}
      <div className="mb-4">
        <SectionHead>Admission Year</SectionHead>
        <div className="flex flex-col gap-0.5">
          {YEARS.map((y) => (
            <HandCheckbox
              key={y}
              checked={selectedYears.includes(y)}
              onChange={() => toggleYear(y)}
              label={String(y)}
            />
          ))}
        </div>
      </div>

      {/* Clear all */}
      {(currentUniSlug || currentSort !== "newest" || selectedYears.length > 0) && (
        <button
          onClick={() => {
            setSelectedYears([]);
            navigate({ sort: "newest", university: undefined, year: undefined, page: undefined });
          }}
          className="w-full text-xs text-gray-400 hover:text-gray-700 border border-dashed border-gray-200 hover:border-gray-300 rounded-lg py-2 transition-all mt-2"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
