"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function EssayTeaserSection() {
  const [shimmer, setShimmer] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setShimmer(true);
      const t = setTimeout(() => setShimmer(false), 900);
      return () => clearTimeout(t);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="px-4 py-20 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #f8faff 0%, #ffffff 100%)",
      }}
    >
      <div className="mx-auto max-w-5xl flex flex-col lg:flex-row items-center gap-14">
        {/* Left: copy */}
        <div className="flex-1 lg:pr-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0851A0]/20 bg-[#e8f1fa] px-3 py-1.5 text-xs font-medium text-[#0851A0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0851A0] animate-pulse" />
            Real writing, real people
          </div>
          <h2 className="font-serif text-3xl font-bold text-gray-900 mb-4 leading-tight">
            Read essays that<br />
            <span className="italic text-[#0851A0]">actually got people in.</span>
          </h2>
          <p className="text-gray-500 text-sm leading-relaxed max-w-sm mb-6">
            Every essay is from a verified admit. Not templates, not samples — real personal statements with real results.
          </p>
          <ul className="space-y-2 text-sm text-gray-500">
            {[
              "Verified admits only — no fake essays",
              "Free preview before you buy",
              "Contact the writer after purchase",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="text-[#0851A0] font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: teaser card */}
        <div className="flex-1 w-full flex justify-center lg:justify-end">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden"
            style={{ boxShadow: "0 24px 64px rgba(37,99,235,0.12), 0 4px 16px rgba(0,0,0,0.06)" }}
          >
            {/* Card header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs bg-[#e8f1fa] text-[#0851A0] rounded-full px-2.5 py-1 font-semibold">
                  Harvard · Common App
                </span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  ★ 4.9
                  <span className="text-gray-300">·</span>
                  650 words
                </span>
              </div>
            </div>

            {/* Essay body */}
            <div className="px-6 pt-5 pb-0">
              {/* Visible first line */}
              <p className="text-sm text-gray-900 font-medium leading-relaxed">
                "I failed chemistry three times before I realized the lab was teaching me more than equations — it was teaching me how to fail gracefully."
              </p>

              {/* Blurred rest with glass overlay */}
              <div className="relative mt-3 pb-2">
                <p
                  className="text-sm text-gray-600 leading-relaxed select-none"
                  style={{ filter: "blur(4px)", userSelect: "none" }}
                  aria-hidden="true"
                >
                  The first time, I blamed the teacher. The second time, I blamed the textbook. By the third attempt in humid August heat, surrounded by shattered glassware and stubborn pride, I had no one left to blame but myself. I began to see each mistake not as a dead end but as a data point...
                </p>
                {/* Glass overlay */}
                <div
                  className="absolute inset-0 flex items-end"
                  style={{
                    background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.6) 40%, rgba(255,255,255,1) 100%)",
                    backdropFilter: "blur(1px)",
                    WebkitBackdropFilter: "blur(1px)",
                  }}
                />
              </div>
            </div>

            {/* Unlock CTA */}
            <div className="px-6 pb-6 pt-3 flex flex-col items-center">
              <Link href="/applications" className="w-full">
                <button className="relative w-full overflow-hidden bg-[#0851A0] hover:bg-[#063d85] text-white text-sm font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02]">
                  <span className="relative z-10">Unlock Full Essay — ₹800</span>
                  {shimmer && (
                    <span
                      className="absolute inset-0 pointer-events-none z-20"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                        animation: "shimmer-slide 0.8s ease-in-out forwards",
                      }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </Link>
              <p className="text-xs text-gray-400 mt-2">Pay once · Keep forever</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
