"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

type SegKind = "type" | "pause" | "backspace" | "newline";
interface Seg { kind: SegKind; text?: string; count?: number; ms?: number }

const ESSAYS: { uni: string; slug: string; prompt: string; sequence: Seg[] }[] = [
  {
    uni: "Stanford University", slug: "stanford",
    prompt: "Describe a moment that changed your perspective.",
    sequence: [
      { kind: "pause", ms: 400 },
      { kind: "type", text: "I failed chemistry three times." },
      { kind: "pause", ms: 700 },
      { kind: "backspace", count: 13 },
      { kind: "pause", ms: 300 },
      { kind: "type", text: "and thought my life was over." },
      { kind: "pause", ms: 500 },
      { kind: "newline" },
      { kind: "type", text: "Each time, I walked out of that exam room convinced I was the one person on Earth who didn't deserve to be there." },
      { kind: "pause", ms: 1800 },
    ],
  },
  {
    uni: "Harvard University", slug: "harvard",
    prompt: "What challenge have you overcome?",
    sequence: [
      { kind: "pause", ms: 400 },
      { kind: "type", text: "I used to think that to change the world, you needed a microscope." },
      { kind: "pause", ms: 500 },
      { kind: "newline" },
      { kind: "type", text: "I was sixteen, holding my grandfather's hand for the last time, wondering if love could outlast silence." },
      { kind: "pause", ms: 1800 },
    ],
  },
  {
    uni: "MIT", slug: "mit",
    prompt: "Tell us something surprising about you.",
    sequence: [
      { kind: "pause", ms: 400 },
      { kind: "type", text: "I built a radio from a cereal box at age nine." },
      { kind: "pause", ms: 500 },
      { kind: "newline" },
      { kind: "type", text: "It didn't work. So I built another. The fifteenth one picked up a jazz station in Miami — I was in Ohio." },
      { kind: "pause", ms: 1800 },
    ],
  },
  {
    uni: "Yale University", slug: "yale",
    prompt: "Describe a place that matters to you.",
    sequence: [
      { kind: "pause", ms: 400 },
      { kind: "type", text: "Every Sunday, my grandmother handed me a worn notebook." },
      { kind: "pause", ms: 500 },
      { kind: "newline" },
      { kind: "type", text: "'Write what you see.' I wrote everything: light on linoleum, cardamom, a silence that felt like memory." },
      { kind: "pause", ms: 1800 },
    ],
  },
];

const TYPE_MS = 20;
const BACK_MS = 45;

function LightSweep() {
  const [pos, setPos] = useState({ x: 30, y: 20 });
  useEffect(() => {
    let t = 0;
    const id = setInterval(() => {
      t += 0.8;
      setPos({
        x: 50 + 42 * Math.cos((t * Math.PI) / 180),
        y: 50 + 22 * Math.sin((t * Math.PI) / 180),
      });
    }, 60);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 55% 32% at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.2) 0%, transparent 65%)`,
          transition: "background 0.12s linear",
        }}
      />
    </div>
  );
}

function TDCursor({ blink }: { blink: boolean }) {
  return (
    <span
      className="inline-flex items-end ml-0.5"
      style={{ opacity: blink ? 0 : 1, transition: "opacity 0.15s" }}
    >
      <Image
        src="/td-logo.png"
        alt=""
        width={12}
        height={12}
        className="object-contain"
        unoptimized
        aria-hidden
      />
    </span>
  );
}

function getTextOpacity(totalChars: number): number {
  if (totalChars <= 100) return 1.0;
  const extra = totalChars - 100;
  const steps = Math.floor(extra / 150);
  const opacity = 1.0 - steps * 0.1;
  return Math.max(0.35, opacity);
}

export function HeroTypewriter() {
  const [ei, setEi] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [si, setSi] = useState(0);
  const [ci, setCi] = useState(0);
  const [bc, setBc] = useState(0);
  const [blink, setBlink] = useState(false);
  const [folding, setFolding] = useState(false);
  const foldingRef = useRef(false);

  // Cursor blink
  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  const essay = ESSAYS[ei];
  const seq = essay.sequence;
  const seg = seq[si];

  // Typing engine
  useEffect(() => {
    if (foldingRef.current) return;

    if (!seg) {
      // Sequence done — trigger fold transition
      const t = setTimeout(() => {
        if (foldingRef.current) return;
        foldingRef.current = true;
        setFolding(true);
        setTimeout(() => {
          const next = (ei + 1) % ESSAYS.length;
          setEi(next);
          setDisplayed("");
          setSi(0);
          setCi(0);
          setBc(0);
          setFolding(false);
          foldingRef.current = false;
        }, 700);
      }, 300);
      return () => clearTimeout(t);
    }

    if (seg.kind === "type") {
      const target = seg.text ?? "";
      if (ci >= target.length) {
        setSi((i) => i + 1);
        setCi(0);
        return;
      }
      const jitter = Math.random() * 18 - 9;
      const t = setTimeout(() => {
        setDisplayed((d) => d + target[ci]);
        setCi((c) => c + 1);
      }, TYPE_MS + jitter);
      return () => clearTimeout(t);
    }

    if (seg.kind === "pause") {
      const t = setTimeout(() => {
        setSi((i) => i + 1);
        setCi(0);
        setBc(0);
      }, seg.ms ?? 600);
      return () => clearTimeout(t);
    }

    if (seg.kind === "backspace") {
      const total = seg.count ?? 1;
      if (bc >= total) {
        setSi((i) => i + 1);
        setCi(0);
        setBc(0);
        return;
      }
      const t = setTimeout(() => {
        setDisplayed((d) => d.slice(0, -1));
        setBc((c) => c + 1);
      }, BACK_MS);
      return () => clearTimeout(t);
    }

    if (seg.kind === "newline") {
      setDisplayed((d) => d + "\n");
      setSi((i) => i + 1);
      setCi(0);
    }
  }, [displayed, seg, si, ci, bc, ei]);

  const totalChars = displayed.replace(/\n/g, "").length;
  const textOpacity = getTextOpacity(totalChars);

  const foldStyle: React.CSSProperties = {
    transform: "rotateX(-180deg)",
    transition: "transform 0.7s cubic-bezier(0.4,0,0.2,1)",
    transformOrigin: "top center",
  };

  const paperStyle: React.CSSProperties = {
    background: "linear-gradient(160deg, #fdfcf8 0%, #faf8f2 60%, #f6f4ec 100%)",
    border: "1px solid rgba(200,188,155,0.45)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(200,188,155,0.25)",
    zIndex: 2,
    position: "relative" as const,
  };

  return (
    <div
      className="relative w-full max-w-2xl select-none"
      style={{
        perspective: "900px",
        filter:
          "drop-shadow(0 8px 40px rgba(8,81,160,0.14)) drop-shadow(0 2px 8px rgba(0,0,0,0.07))",
      }}
    >
      {/* Paper stack layer 2 (most behind) */}
      <div
        className="absolute inset-x-4 bottom-0 h-full rounded-3xl pointer-events-none"
        style={{
          zIndex: 0,
          background: "linear-gradient(160deg, #fdfcf8 0%, #faf8f2 60%, #f6f4ec 100%)",
          border: "1px solid rgba(200,188,155,0.35)",
          transform: "translateY(8px) rotate(-1deg)",
        }}
      />
      {/* Paper stack layer 1 */}
      <div
        className="absolute inset-x-2 bottom-0 h-full rounded-3xl pointer-events-none"
        style={{
          zIndex: 1,
          background: "linear-gradient(160deg, #fdfcf8 0%, #faf8f2 60%, #f6f4ec 100%)",
          border: "1px solid rgba(200,188,155,0.4)",
          transform: "translateY(4px) rotate(0.5deg)",
        }}
      />

      {/* Active paper — the one that folds */}
      <div
        className="rounded-3xl overflow-hidden"
        style={folding ? { ...paperStyle, ...foldStyle } : paperStyle}
      >
        <LightSweep />

        {/* Letterhead */}
        <div
          className="relative z-10 px-6 pt-5 pb-3 border-b"
          style={{ borderColor: "rgba(200,188,155,0.3)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-amber-100 shadow-sm bg-white flex items-center justify-center flex-shrink-0">
                <Image
                  src={`/uni_logos/${essay.slug}.png`}
                  alt={essay.uni}
                  width={24}
                  height={24}
                  className="object-contain"
                  unoptimized
                />
              </div>
              <span
                className="text-xs font-semibold text-gray-500 tracking-widest"
                style={{ fontVariant: "small-caps" }}
              >
                {essay.uni}
              </span>
            </div>
            <span className="text-[10px] text-gray-300 tracking-widest uppercase">
              Personal Statement
            </span>
          </div>
          <div
            className="mt-2.5 h-px"
            style={{
              background: "linear-gradient(to right, #0851A0, rgba(8,81,160,0.08))",
            }}
          />
        </div>

        {/* Prompt */}
        <div className="relative z-10 px-6 pt-4 pb-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Prompt
          </p>
          <p className="font-hand text-sm text-gray-600 italic leading-relaxed mb-4">
            {essay.prompt}
          </p>
        </div>

        {/* Essay text */}
        <div className="relative z-10 px-6 pb-0 min-h-[110px]">
          <p
            className="font-serif text-sm leading-loose whitespace-pre-wrap"
            style={{ color: "#1a1a1a", opacity: textOpacity }}
          >
            {displayed.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
            <TDCursor blink={blink} />
          </p>
        </div>

        {/* Frosted bottom */}
        <div className="relative z-10 h-20 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(253,252,248,0) 0%, rgba(253,252,248,0.9) 55%, rgba(250,248,242,1) 100%)",
            }}
          />
          <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1.5">
            <span className="text-gray-300 text-xs">🔒</span>
            <span className="text-xs text-gray-400 tracking-wide">
              Preview · Unlock to read in full
            </span>
          </div>
        </div>

        {/* Paper curl bottom-right corner */}
        <div
          className="absolute bottom-0 right-0 pointer-events-none z-20"
          style={{
            width: 26,
            height: 26,
            background: "linear-gradient(225deg, #e2dbca 45%, transparent 45%)",
            borderTopLeftRadius: 8,
          }}
          aria-hidden
        />
      </div>
    </div>
  );
}
