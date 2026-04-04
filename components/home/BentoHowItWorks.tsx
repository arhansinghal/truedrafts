"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ── Pencil sketch SVG icons ───────────────────────────────────────────────── */

function BookPencilIcon({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={`w-16 h-16 transition-all duration-700 ${dim ? "opacity-40" : "opacity-100"}`}
      style={{ filter: dim ? "none" : "drop-shadow(0 2px 4px rgba(8,81,160,0.18))" }}>
      <defs>
        <filter id="pencil-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={dim ? 0 : 2} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <g filter="url(#pencil-rough)" stroke="#0851A0" strokeWidth={dim ? 1.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M12 8 C8 6 6 7 5 10 L5 68 C8 66 12 66 15 68 L40 68 L40 8 Z" strokeDasharray={dim ? "3 2" : "none"}/>
        <path d="M40 8 C44 6 50 6 55 8 L55 68 L40 68 Z" strokeDasharray={dim ? "3 2" : "none"}/>
        <line x1="12" y1="20" x2="34" y2="18" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="12" y1="28" x2="34" y2="26" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="12" y1="36" x2="28" y2="34" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="46" y1="20" x2="52" y2="22" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="46" y1="30" x2="52" y2="32" strokeWidth={dim ? 1 : 1.5}/>
        {/* Pencil on top */}
        <rect x="54" y="10" width="8" height="28" rx="1" transform="rotate(-30 58 24)" strokeWidth={dim ? 1 : 2}/>
        <path d="M60 34 L62 38 L56 36 Z" transform="rotate(-30 58 24)"/>
      </g>
    </svg>
  );
}

function KeyPencilIcon({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={`w-16 h-16 transition-all duration-700 ${dim ? "opacity-40" : "opacity-100"}`}
      style={{ filter: dim ? "none" : "drop-shadow(0 2px 4px rgba(8,81,160,0.18))" }}>
      <defs>
        <filter id="pencil-rough2">
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={dim ? 0 : 2.5} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <g filter="url(#pencil-rough2)" stroke="#0851A0" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="28" cy="30" r="16" strokeWidth={dim ? 1.5 : 2.5} strokeDasharray={dim ? "4 3" : "none"}/>
        <circle cx="28" cy="30" r="7" strokeWidth={dim ? 1 : 1.8}/>
        <line x1="40" y1="41" x2="65" y2="62" strokeWidth={dim ? 1.5 : 2.5}/>
        <line x1="55" y1="55" x2="55" y2="65" strokeWidth={dim ? 1 : 2}/>
        <line x1="62" y1="60" x2="62" y2="68" strokeWidth={dim ? 1 : 2}/>
        {/* Sparkle on unlock */}
        {!dim && <>
          <line x1="62" y1="14" x2="62" y2="22"/>
          <line x1="58" y1="18" x2="66" y2="18"/>
          <line x1="59" y1="15" x2="65" y2="21"/>
          <line x1="65" y1="15" x2="59" y2="21"/>
        </>}
      </g>
    </svg>
  );
}

function ChartPencilIcon({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={`w-16 h-16 transition-all duration-700 ${dim ? "opacity-40" : "opacity-100"}`}
      style={{ filter: dim ? "none" : "drop-shadow(0 2px 4px rgba(255,255,255,0.25))" }}>
      <g stroke="white" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="10" y1="65" x2="70" y2="65" strokeWidth={dim ? 1 : 2}/>
        <line x1="10" y1="10" x2="10" y2="65" strokeWidth={dim ? 1 : 2}/>
        <rect x="18" y="42" width="10" height="23" strokeWidth={dim ? 1 : 1.8} strokeDasharray={dim ? "3 2" : "none"}/>
        <rect x="34" y="28" width="10" height="37" strokeWidth={dim ? 1 : 1.8} strokeDasharray={dim ? "3 2" : "none"}/>
        <rect x="50" y="16" width="10" height="49" strokeWidth={dim ? 1 : 1.8} strokeDasharray={dim ? "3 2" : "none"}/>
        <path d="M18 38 Q35 22 60 12" strokeWidth={dim ? 1 : 1.5} strokeDasharray="4 2"/>
      </g>
    </svg>
  );
}

function ChatPencilIcon({ dim }: { dim: boolean }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={`w-16 h-16 transition-all duration-700 ${dim ? "opacity-40" : "opacity-100"}`}
      style={{ filter: dim ? "none" : "drop-shadow(0 2px 4px rgba(147,51,234,0.2))" }}>
      <defs>
        <filter id="pencil-rough4">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" result="noise"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={dim ? 0 : 2} xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <g filter="url(#pencil-rough4)" stroke="#7c3aed" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <rect x="5" y="8" width="42" height="32" rx="5" strokeWidth={dim ? 1.5 : 2.5} strokeDasharray={dim ? "4 3" : "none"}/>
        <path d="M8 40 L8 52 L20 40" strokeWidth={dim ? 1 : 2}/>
        <line x1="12" y1="18" x2="40" y2="18" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="12" y1="26" x2="36" y2="26" strokeWidth={dim ? 1 : 1.5}/>
        <rect x="28" y="30" width="44" height="30" rx="5" strokeWidth={dim ? 1.5 : 2.5} strokeDasharray={dim ? "4 3" : "none"}/>
        <path d="M70 60 L70 70 L58 60" strokeWidth={dim ? 1 : 2}/>
        <line x1="34" y1="40" x2="64" y2="40" strokeWidth={dim ? 1 : 1.5}/>
        <line x1="34" y1="48" x2="58" y2="48" strokeWidth={dim ? 1 : 1.5}/>
      </g>
    </svg>
  );
}

/* ── Pencil arrow connector ──────────────────────────────────────────────── */
function SketchArrow() {
  return (
    <svg viewBox="0 0 120 60" fill="none" className="hidden md:block w-24 h-12 shrink-0 opacity-25">
      <path d="M5,30 C25,8 75,52 110,28" stroke="#0851A0" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round"/>
      <path d="M102,22 L110,28 L103,34" stroke="#0851A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Extra wobbly texture strokes */}
      <path d="M30,28 Q55,38 80,26" stroke="#0851A0" strokeWidth="0.8" strokeDasharray="3 5" strokeLinecap="round" opacity="0.4"/>
    </svg>
  );
}

/* ── Scroll-reveal hook ──────────────────────────────────────────────────── */
function useInView(threshold = 0.4) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Individual sketch cards ────────────────────────────────────────────── */

function BrowseCard() {
  const { ref, inView } = useInView(0.3);
  const dim = !inView;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      ref={ref}
      className="md:col-span-2 rounded-3xl p-8 flex flex-col gap-6 min-h-[300px] cursor-default relative overflow-hidden bg-dot-grid transition-all duration-700"
      style={{
        border: dim ? "1.5px dashed rgba(8,81,160,0.2)" : "1.5px solid rgba(8,81,160,0.18)",
        opacity: dim ? 0.55 : 1,
        filter: dim ? "none" : "drop-shadow(0 4px 20px rgba(8,81,160,0.08))",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Corner doodle marks */}
      <div className="absolute top-3 left-4 w-6 h-6 border-t-2 border-l-2 border-[#0851A0]/20 rounded-tl-lg pointer-events-none"/>
      <div className="absolute top-3 right-4 w-6 h-6 border-t-2 border-r-2 border-[#0851A0]/20 rounded-tr-lg pointer-events-none"/>
      <div className="absolute bottom-3 left-4 w-6 h-6 border-b-2 border-l-2 border-[#0851A0]/20 rounded-bl-lg pointer-events-none"/>

      <div className="flex flex-col sm:flex-row items-start gap-6">
        <BookPencilIcon dim={dim} />
        <div>
          <h3 className={`font-hand text-2xl font-bold mb-2 transition-all duration-700 ${dim ? "text-gray-400" : "text-gray-900"}`}
            style={{ letterSpacing: "0.02em" }}>
            Browse Real Essays
          </h3>
          <p className={`text-sm leading-relaxed max-w-xs transition-all duration-700 ${dim ? "text-gray-300" : "text-gray-500"}`}>
            Explore verified essays from students who got into Harvard, MIT, Stanford, and 30+ other top schools.
          </p>
        </div>
      </div>

      {/* Live mini essay preview */}
      <div
        className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 transition-all duration-500"
        style={{
          boxShadow: hovered && !dim
            ? "0 12px 40px rgba(8,81,160,0.15), 0 0 0 1px rgba(8,81,160,0.1)"
            : "0 2px 8px rgba(0,0,0,0.06)",
          transform: hovered && !dim ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
          border: "1px dashed rgba(8,81,160,0.15)",
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[10px] bg-[#e8f1fa] text-[#0851A0] rounded-full px-2 py-0.5 font-semibold">Harvard · Common App</span>
          <span className="text-[10px] text-gray-400">650 words</span>
        </div>
        <p className="font-hand text-sm text-gray-800 leading-relaxed mb-3">
          "I failed chemistry three times before I realized the lab was teaching me something more valuable than equations..."
        </p>
        <div className="space-y-1.5">
          {[100, 88, 95, 65].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${w}%`, background: hovered && !dim ? "#c5dcf0" : "#f0ede6" }}/>
          ))}
        </div>
        {hovered && !dim && (
          <div className="mt-3 flex items-center justify-between border-t border-blue-50 pt-2">
            <span className="text-[10px] text-gray-400">Free preview available</span>
            <span className="text-[10px] text-[#0851A0] font-semibold">Read essay →</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UnlockCard() {
  const { ref, inView } = useInView(0.4);
  const dim = !inView;

  return (
    <div
      ref={ref}
      className="md:col-span-1 rounded-3xl p-8 flex flex-col justify-between min-h-[280px] bg-dot-grid relative overflow-hidden transition-all duration-700"
      style={{
        border: dim ? "1.5px dashed rgba(8,81,160,0.15)" : "1.5px solid rgba(8,81,160,0.18)",
        opacity: dim ? 0.5 : 1,
        filter: dim ? "none" : "drop-shadow(0 4px 20px rgba(8,81,160,0.06))",
      }}
    >
      <div className="absolute bottom-3 right-4 w-6 h-6 border-b-2 border-r-2 border-[#0851A0]/20 rounded-br-lg pointer-events-none"/>
      <div>
        <KeyPencilIcon dim={dim} />
        <h3 className={`font-hand text-2xl font-bold mt-4 mb-2 transition-all duration-700 ${dim ? "text-gray-400" : "text-gray-900"}`}>
          Unlock &amp; Read
        </h3>
        <p className={`text-sm leading-relaxed transition-all duration-700 ${dim ? "text-gray-300" : "text-gray-500"}`}>
          Pay once per essay — typically $5–15. Yours to keep in your personal library forever.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {["$5", "$8", "$12", "$15"].map((p) => (
          <span key={p}
            className={`text-xs rounded-full px-3 py-1 font-semibold shadow-sm border transition-all duration-700 ${
              dim
                ? "bg-gray-100 border-gray-200 text-gray-400"
                : "bg-white/80 border-[#9dc3e6] text-[#0851A0]"
            }`}
            style={{ fontFamily: "var(--font-hand, cursive)" }}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatsCard() {
  const { ref, inView } = useInView(0.4);
  const dim = !inView;

  return (
    <div
      ref={ref}
      className="md:col-span-1 rounded-3xl p-8 flex flex-col justify-between min-h-[260px] bg-dot-grid relative overflow-hidden transition-all duration-700"
      style={{
        border: dim ? "1.5px dashed rgba(8,81,160,0.15)" : "1.5px solid rgba(8,81,160,0.18)",
        opacity: dim ? 0.5 : 1,
        filter: dim ? "none" : "drop-shadow(0 4px 20px rgba(8,81,160,0.06))",
      }}
    >
      <div className="absolute top-3 left-4 w-6 h-6 border-t-2 border-l-2 border-[#0851A0]/20 rounded-tl-lg pointer-events-none"/>
      <div className="absolute bottom-3 right-4 w-6 h-6 border-b-2 border-r-2 border-[#0851A0]/20 rounded-br-lg pointer-events-none"/>

      {/* Hand-sketched sparkline */}
      <svg viewBox="0 0 80 40" fill="none" className={`w-16 h-10 mb-2 transition-all duration-700 ${dim ? "opacity-30" : "opacity-100"}`}
        style={{ filter: dim ? "none" : "drop-shadow(0 1px 3px rgba(8,81,160,0.2))" }}>
        <defs>
          <filter id="sketch-stats">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={dim ? 0 : 1.5} xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
        <g filter="url(#sketch-stats)" stroke="#0851A0" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <polyline points="4,34 16,28 28,20 36,22 48,10 64,6 76,2" strokeWidth={dim ? 1 : 2.2} strokeDasharray={dim ? "3 2" : "none"}/>
          <circle cx="76" cy="2" r="3" strokeWidth={dim ? 1 : 1.8} fill={dim ? "transparent" : "#e8f1fa"}/>
          {!dim && <path d="M70,-2 L76,2 L72,8" strokeWidth="1.5"/>}
          {/* Tiny tick marks */}
          <line x1="4" y1="36" x2="4" y2="38" strokeWidth="1" opacity="0.4"/>
          <line x1="28" y1="36" x2="28" y2="38" strokeWidth="1" opacity="0.4"/>
          <line x1="52" y1="36" x2="52" y2="38" strokeWidth="1" opacity="0.4"/>
          <line x1="76" y1="36" x2="76" y2="38" strokeWidth="1" opacity="0.4"/>
          <line x1="2" y1="2" x2="2" y2="36" strokeWidth="1" opacity="0.3"/>
        </g>
      </svg>

      <h3 className={`font-hand text-2xl font-bold mb-4 transition-all duration-700 ${dim ? "text-gray-400" : "text-gray-900"}`}>
        By the numbers
      </h3>
      <div className="space-y-2.5">
        {[
          { n: "500+", label: "essays published" },
          { n: "30+",  label: "universities" },
          { n: "50%",  label: "writers earn" },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold font-hand transition-all duration-700 ${dim ? "text-gray-300" : "text-[#0851A0]"}`}>{n}</span>
            <span className={`text-sm transition-all duration-700 ${dim ? "text-gray-300" : "text-gray-500"}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectCard() {
  const { ref, inView } = useInView(0.35);
  const dim = !inView;

  return (
    <div
      ref={ref}
      className="md:col-span-2 rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6 min-h-[180px] bg-dot-grid relative overflow-hidden transition-all duration-700"
      style={{
        border: dim ? "1.5px dashed rgba(8,81,160,0.15)" : "1.5px solid rgba(8,81,160,0.18)",
        opacity: dim ? 0.5 : 1,
        filter: dim ? "none" : "drop-shadow(0 4px 16px rgba(8,81,160,0.06))",
      }}
    >
      <div className="absolute top-3 left-4 w-6 h-6 border-t-2 border-l-2 border-[#0851A0]/20 rounded-tl-lg pointer-events-none"/>
      <div className="absolute bottom-3 right-4 w-6 h-6 border-b-2 border-r-2 border-[#0851A0]/20 rounded-br-lg pointer-events-none"/>
      {/* Tiny asterisk accent */}
      <span className="absolute top-4 right-12 text-[#0851A0]/20 text-lg pointer-events-none select-none font-hand">✦</span>
      <span className="absolute bottom-5 left-20 text-[#0851A0]/15 text-sm pointer-events-none select-none font-hand">✦</span>

      <ChatPencilIcon dim={dim} />
      <div>
        <h3 className={`font-hand text-2xl font-bold mb-2 transition-all duration-700 ${dim ? "text-gray-400" : "text-gray-900"}`}>
          Connect with Writers
        </h3>
        <p className={`text-sm leading-relaxed max-w-sm transition-all duration-700 ${dim ? "text-gray-300" : "text-gray-500"}`}>
          After purchasing, get the writer's contact. Ask them directly — what worked, what didn't, what they'd do differently.
        </p>
      </div>
      <div className="sm:ml-auto shrink-0">
        <Link href="/applications">
          <button className={`text-sm font-semibold border px-5 py-2.5 rounded-xl transition-all shadow-sm ${
            dim
              ? "text-gray-400 border-gray-200 bg-white/50"
              : "text-[#0851A0] border-[#0851A0]/25 bg-white/80 hover:bg-white hover:shadow-md hover:border-[#0851A0]/40"
          }`} style={{ fontFamily: "var(--font-hand, cursive)" }}>
            Browse essays →
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ── Main export ────────────────────────────────────────────────────────── */
export function BentoHowItWorks() {
  return (
    <section className="px-4 py-24 bg-dot-grid relative">
      {/* Section header */}
      <div className="mx-auto max-w-5xl mb-14 text-center relative">
        {/* Sketchy underline under "How It Works" */}
        <div className="relative inline-block">
          <h2 className="font-hand text-4xl font-bold text-gray-900 mb-3" style={{ letterSpacing: "0.01em" }}>
            How It Works
          </h2>
          <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
            <path d="M4,8 Q75,2 150,8 Q225,14 296,6" stroke="#0851A0" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
            <path d="M8,10 Q80,5 155,10 Q230,15 292,8" stroke="#0851A0" strokeWidth="1" strokeLinecap="round" opacity="0.2"/>
          </svg>
        </div>
        <p className="mt-6 text-sm text-gray-400" style={{ fontFamily: "var(--font-hand, cursive)" }}>
          Three simple steps · sketched out for you
        </p>
      </div>

      {/* Bento grid */}
      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-5 relative">
        {/* Sketchy connecting line in the background */}
        <svg className="absolute -z-10 inset-0 w-full h-full pointer-events-none hidden md:block" viewBox="0 0 900 700" preserveAspectRatio="none">
          {/* Browse → Unlock */}
          <path d="M580,130 Q660,100 720,155" stroke="#0851A0" strokeWidth="1.5" strokeDasharray="6 5" fill="none" opacity="0.13" strokeLinecap="round"/>
          <path d="M716,148 L720,155 L712,156" stroke="#0851A0" strokeWidth="1.5" fill="none" opacity="0.13" strokeLinecap="round"/>
          {/* Unlock → Connect */}
          <path d="M700,330 Q680,420 580,470" stroke="#0851A0" strokeWidth="1.2" strokeDasharray="5 5" fill="none" opacity="0.1" strokeLinecap="round"/>
          {/* Browse → Numbers */}
          <path d="M200,320 Q250,400 300,450" stroke="#0851A0" strokeWidth="1.2" strokeDasharray="4 5" fill="none" opacity="0.1" strokeLinecap="round"/>
          {/* Decorative loop */}
          <ellipse cx="450" cy="350" rx="70" ry="40" stroke="#0851A0" strokeWidth="0.8" strokeDasharray="5 8" fill="none" opacity="0.07" transform="rotate(-15 450 350)"/>
        </svg>

        <BrowseCard />
        <UnlockCard />
        <StatsCard />
        <ConnectCard />
      </div>
    </section>
  );
}
