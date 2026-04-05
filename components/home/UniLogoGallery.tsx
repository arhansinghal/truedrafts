"use client";
import Link from "next/link";
import Image from "next/image";

// Exclude georgetown, jhu, nyu from gallery as per user request
// padding controls image size within the box: smaller = image appears larger
const UNI_DATA: { slug: string; name: string; padding: string }[] = [
  { slug: "harvard",       name: "Harvard",       padding: "p-2" },
  { slug: "mit",           name: "MIT",            padding: "p-2" },
  { slug: "stanford",      name: "Stanford",       padding: "p-3" },    // zoom out
  { slug: "yale",          name: "Yale",           padding: "p-2" },
  { slug: "princeton",     name: "Princeton",      padding: "p-2" },
  { slug: "columbia",      name: "Columbia",       padding: "p-1" },    // zoom in
  { slug: "upenn",         name: "UPenn",          padding: "p-2" },
  { slug: "brown",         name: "Brown",          padding: "p-2" },
  { slug: "dartmouth",     name: "Dartmouth",      padding: "p-2" },
  { slug: "cornell",       name: "Cornell",        padding: "p-2" },
  { slug: "duke",          name: "Duke",           padding: "p-2" },
  { slug: "northwestern",  name: "Northwestern",   padding: "p-3" },    // zoom out
  { slug: "vanderbilt",    name: "Vanderbilt",     padding: "p-3" },    // zoom out
  { slug: "rice",          name: "Rice",           padding: "p-2" },
  { slug: "washu",         name: "WashU",          padding: "p-2" },
  { slug: "notre-dame",    name: "Notre Dame",     padding: "p-2" },
  { slug: "emory",         name: "Emory",          padding: "p-2" },
  { slug: "cmu",           name: "CMU",            padding: "p-2" },
  { slug: "umich",         name: "U Michigan",     padding: "p-3" },    // zoom out
  { slug: "uc-berkeley",   name: "UC Berkeley",    padding: "p-2" },
  { slug: "ucla",          name: "UCLA",           padding: "p-3" },    // zoom out
  { slug: "uva",           name: "UVA",            padding: "p-2" },
  { slug: "unc",           name: "UNC",            padding: "p-2" },
  { slug: "usc",           name: "USC",            padding: "p-2" },
  { slug: "boston-college",name: "Boston College", padding: "p-2" },
  { slug: "tufts",         name: "Tufts",          padding: "p-2" },
  { slug: "wellesley",     name: "Wellesley",      padding: "p-3" },    // zoom out
];

const ROW_1 = UNI_DATA.slice(0, 14);
const ROW_2 = UNI_DATA.slice(14);

const MASK = "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)";

function LogoItem({ slug, name, padding }: { slug: string; name: string; padding: string }) {
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
          className={`object-contain ${padding} grayscale opacity-45 transition-all duration-500 ease-out group-hover:grayscale-0 group-hover:opacity-100`}
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
            <LogoItem key={`r1-${i}`} slug={uni.slug} name={uni.name} padding={uni.padding} />
          ))}
        </div>
      </div>

      <div className="h-5" />

      {/* Row 2 — scrolls right */}
      <div className="relative overflow-hidden" style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
        <div className="flex" style={{ width: "max-content", animation: "marquee-slow-reverse 55s linear infinite" }}>
          {[...ROW_2, ...ROW_2].map((uni, i) => (
            <LogoItem key={`r2-${i}`} slug={uni.slug} name={uni.name} padding={uni.padding} />
          ))}
        </div>
      </div>
    </section>
  );
}
