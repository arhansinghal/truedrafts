"use client";
import Link from "next/link";
import Image from "next/image";

// Logo assets are normalized to a uniform content box (centered, ~75% of a
// 400x400 canvas) in public/uni_logos/, so every logo renders at the same size
// here — no per-logo padding tuning needed.
const UNI_DATA: { slug: string; name: string }[] = [
  { slug: "harvard",        name: "Harvard" },
  { slug: "mit",            name: "MIT" },
  { slug: "stanford",       name: "Stanford" },
  { slug: "yale",           name: "Yale" },
  { slug: "princeton",      name: "Princeton" },
  { slug: "columbia",       name: "Columbia" },
  { slug: "upenn",          name: "UPenn" },
  { slug: "brown",          name: "Brown" },
  { slug: "dartmouth",      name: "Dartmouth" },
  { slug: "cornell",        name: "Cornell" },
  { slug: "duke",           name: "Duke" },
  { slug: "northwestern",   name: "Northwestern" },
  { slug: "vanderbilt",     name: "Vanderbilt" },
  { slug: "rice",           name: "Rice" },
  { slug: "uchicago",       name: "UChicago" },
  { slug: "georgia-tech",   name: "Georgia Tech" },
  { slug: "uiuc",           name: "UIUC" },
  { slug: "washu",          name: "WashU" },
  { slug: "notre-dame",     name: "Notre Dame" },
  { slug: "emory",          name: "Emory" },
  { slug: "cmu",            name: "CMU" },
  { slug: "umich",          name: "U Michigan" },
  { slug: "uc-berkeley",    name: "UC Berkeley" },
  { slug: "ucla",           name: "UCLA" },
  { slug: "ucsd",           name: "UC San Diego" },
  { slug: "ucsb",           name: "UC Santa Barbara" },
  { slug: "uci",            name: "UC Irvine" },
  { slug: "uva",            name: "UVA" },
  { slug: "unc",            name: "UNC" },
  { slug: "usc",            name: "USC" },
  { slug: "purdue",         name: "Purdue" },
  { slug: "boston-college", name: "Boston College" },
  { slug: "tufts",          name: "Tufts" },
  { slug: "wellesley",      name: "Wellesley" },
];

const half = Math.ceil(UNI_DATA.length / 2);
const ROW_1 = UNI_DATA.slice(0, half);
const ROW_2 = UNI_DATA.slice(half);

const MASK = "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)";

function LogoItem({ slug, name }: { slug: string; name: string }) {
  return (
    <Link
      href={`/applications?university=${slug}`}
      className="group mx-6 flex flex-col items-center gap-2 shrink-0"
      title={`Browse ${name} essays`}
    >
      <div className="w-24 h-24 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden transition-all duration-500 ease-out group-hover:shadow-xl group-hover:scale-110 group-hover:border-gray-200 group-hover:-translate-y-1.5">
        <Image
          src={`/uni_logos/${slug}.png`}
          alt={name}
          width={80}
          height={80}
          className="object-contain p-1 grayscale opacity-45 transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:opacity-100"
          unoptimized
        />
      </div>
      <span className="text-xs text-gray-400 group-hover:text-gray-700 transition-colors duration-300 text-center max-w-[96px] truncate leading-tight font-medium">
        {name}
      </span>
    </Link>
  );
}

export function UniLogoGallery() {
  return (
    <section className="py-20 overflow-hidden bg-dot-grid">
      <div className="mx-auto max-w-6xl px-4 mb-10 text-center">
        <h2 className="font-serif text-2xl font-bold text-gray-800">
          Essays from admits at
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Click any school to browse its essays
        </p>
      </div>

      {/* Row 1 — scrolls left */}
      <div className="relative overflow-hidden" style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
        <div className="flex" style={{ width: "max-content", animation: "marquee-slow 55s linear infinite" }}>
          {[...ROW_1, ...ROW_1].map((uni, i) => (
            <LogoItem key={`r1-${i}`} slug={uni.slug} name={uni.name} />
          ))}
        </div>
      </div>

      <div className="h-5" />

      {/* Row 2 — scrolls right */}
      <div className="relative overflow-hidden" style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
        <div className="flex" style={{ width: "max-content", animation: "marquee-slow-reverse 55s linear infinite" }}>
          {[...ROW_2, ...ROW_2].map((uni, i) => (
            <LogoItem key={`r2-${i}`} slug={uni.slug} name={uni.name} />
          ))}
        </div>
      </div>
    </section>
  );
}
