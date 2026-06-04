"use client";

// Immersive "Manuscript" reader for an application detail page.
// Full-bleed fixed overlay: progress bar, top chrome, frontispiece, editor's
// note, paginated multi-essay reading (when unlocked) with margin annotations,
// reading settings, chapter rail, and an unlock gate (when locked).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Files,
  Clock,
  CheckCircle,
  Sparkles,
  Shield,
  PenLine,
} from "lucide-react";
import { ApplicationPaywall } from "@/components/applications/ApplicationPaywall";
import { formatCents } from "@/lib/utils";

export interface ReaderEssay {
  kind: string;
  title: string;
  prompt?: string;
  words?: number;
  paras: string[];
}

export interface ReaderData {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  university: { name: string; slug: string };
  admittedYear?: number | null;
  essays: ReaderEssay[];
  editorNote?: string | null;
  themes: string[];
  marginNotes: string[];
  readMins: number;
  isPurchased: boolean;
  isLoggedIn: boolean;
  watermarkEmail?: string | null;
  writer?: { name: string; bio?: string | null; verifiedAdmit?: boolean } | null;
}

function UniLogo({ slug, name, size = 30, radius = 8 }: { slug: string; name: string; size?: number; radius?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius, background: "#fff", border: "1px solid var(--line)" }}
    >
      <Image src={`/uni_logos/${slug}.png`} alt={name} width={size} height={size} className="h-[76%] w-[76%] object-contain" unoptimized />
    </div>
  );
}

export function ApplicationReader({ data }: { data: ReaderData }) {
  const router = useRouter();
  const [purchased, setPurchased] = useState(data.isPurchased);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [s, setS] = useState({ size: "m", body: "serif", width: "cozy", notes: true });
  const set = (k: string, v: string | boolean) => setS((p) => ({ ...p, [k]: v }));
  const scroller = useRef<HTMLDivElement>(null);

  const fontPx = s.size === "s" ? 17.5 : s.size === "l" ? 22 : 19.5;
  const lineH = s.body === "serif" ? 1.95 : 1.8;
  const colW = s.width === "wide" ? 1080 : 900;

  // After a successful purchase, ApplicationPaywall calls router.refresh(); the
  // server re-renders with data.isPurchased=true, which we mirror into state.
  useEffect(() => {
    if (data.isPurchased) {
      setPurchased(true);
      setActive(0);
    }
  }, [data.isPurchased]);

  // The reader is a full-takeover overlay (it sits above the marketing navbar,
  // which is sticky z-50). Lock the page behind it so the footer can't add a
  // background scrollbar; restore on unmount (e.g. navigating to "Applications").
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const watermark = useMemo(() => {
    if (!purchased || !data.watermarkEmail) return undefined;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='340' height='160'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' transform='rotate(-25, 170, 80)' font-size='13' font-family='sans-serif' fill='rgba(8,81,160,0.07)' font-weight='600'>${data.watermarkEmail}</text></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }, [purchased, data.watermarkEmail]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [purchased, s, active]);

  function goChapter(i: number) {
    if (!purchased && i > 0) return;
    setActive(i);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const essays = data.essays;
  const last = essays.length - 1;
  const showFront = !purchased || active === 0;
  const current: ReaderEssay = essays[purchased ? active : 0] ?? {
    kind: "",
    title: data.title,
    paras: [],
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "var(--paper)" }}>
      {/* progress */}
      <div className="relative z-30 h-[3px] shrink-0">
        <div className="h-full" style={{ width: progress * 100 + "%", background: "var(--td-blue)", transition: "width .1s linear" }} />
      </div>

      {/* chrome */}
      <header
        className="z-25 shrink-0"
        style={{ borderBottom: "1px solid var(--line)", background: "rgba(251,250,246,.85)", backdropFilter: "blur(10px)" }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-7 py-[11px]">
          <button
            onClick={() => router.push("/applications")}
            className="inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-semibold"
            style={{ color: "var(--ink-soft)" }}
          >
            <ChevronLeft className="h-4 w-4" /> Applications
          </button>
          <div className="flex min-w-0 items-center gap-[9px]">
            <UniLogo slug={data.university.slug} name={data.university.name} size={22} radius={6} />
            <span className="serif truncate text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
              {data.title}
            </span>
          </div>
          <TypeControls s={s} set={set} />
        </div>
      </header>

      {/* scroll body */}
      <div ref={scroller} className="tdx-scroll relative flex-1 overflow-y-auto">
        <ChapterRail essays={essays} active={active} goChapter={goChapter} purchased={purchased} progress={progress} colW={colW} readMins={data.readMins} />

        <div className="mx-auto px-7 pb-[120px]" style={{ maxWidth: colW, transition: "max-width .3s" }}>
          {showFront && <Frontispiece data={data} />}
          {showFront && data.editorNote && <EditorNote text={data.editorNote} />}

          {purchased && essays.length > 1 && <ChapterTabs essays={essays} active={active} onPick={goChapter} />}

          <div style={{ marginTop: showFront ? 52 : 8 }}>
            <Chapter
              key={purchased ? active : "locked"}
              essay={current}
              index={purchased ? active : 0}
              fontPx={fontPx}
              lineH={lineH}
              bodyFont={s.body}
              showNotes={s.notes}
              marginNotes={purchased && active === 0 ? data.marginNotes : []}
              locked={!purchased}
              watermark={watermark}
            />
          </div>

          {!purchased && <UnlockGate data={data} />}

          {purchased && essays.length > 1 && <ChapterFooter essays={essays} active={active} onPick={goChapter} />}
          {purchased && active === last && data.writer && <WriterNote writer={data.writer} />}
        </div>
      </div>
    </div>
  );
}

// ── Highlighted paragraph + margin annotation ──────────────────────────────────
function Para({
  text,
  note,
  fontPx,
  lineH,
  bodyFont,
  showNotes,
  drop,
}: {
  text: string;
  note?: string;
  fontPx: number;
  lineH: number;
  bodyFont: string;
  showNotes: boolean;
  drop?: boolean;
}) {
  const body = drop ? text.slice(1) : text;
  return (
    <div className="mt-[1.15em] grid items-start gap-[34px]" style={{ gridTemplateColumns: "minmax(0,1fr) 232px" }}>
      <p
        className={bodyFont === "serif" ? "serif" : ""}
        style={{ margin: 0, fontSize: fontPx, lineHeight: lineH, color: "var(--ink)", letterSpacing: bodyFont === "serif" ? "0" : "-.005em" }}
      >
        {drop && (
          <span className="serif float-left pr-2.5 font-semibold" style={{ fontSize: fontPx * 3.1, lineHeight: 0.8, color: "var(--td-blue)", marginTop: 8 }}>
            {text[0]}
          </span>
        )}
        {body}
      </p>
      <div className="relative" style={{ minHeight: 1 }}>
        {note && showNotes && (
          <div style={{ opacity: 0.78 }}>
            <div className="mb-[5px] flex items-center gap-[7px]">
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--td-blue)" }} />
              <span className="eyebrow" style={{ color: "var(--td-blue)", fontSize: 9.5 }}>What readers noticed</span>
            </div>
            <p className="serif italic" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-soft)" }}>
              {note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Chapter({
  essay,
  index,
  fontPx,
  lineH,
  bodyFont,
  showNotes,
  marginNotes,
  locked,
  watermark,
}: {
  essay: ReaderEssay;
  index: number;
  fontPx: number;
  lineH: number;
  bodyFont: string;
  showNotes: boolean;
  marginNotes: string[];
  locked: boolean;
  watermark?: string;
}) {
  const paras = locked ? essay.paras.slice(0, 3) : essay.paras;
  return (
    <section style={{ scrollMarginTop: 80 }}>
      <div className="mb-[30px] grid gap-[34px]" style={{ gridTemplateColumns: "minmax(0,1fr) 232px" }}>
        <div>
          <div className="mb-3.5 flex items-center gap-3">
            <span className="mono text-[13px] font-semibold" style={{ color: "var(--td-blue)" }}>{String(index + 1).padStart(2, "0")}</span>
            <span className="h-px w-7" style={{ background: "var(--blue-line)" }} />
            <span className="eyebrow">{essay.kind}{essay.words ? ` · ${essay.words} words` : ""}</span>
          </div>
          <h2 className="serif mb-3.5 text-[27px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-.015em" }}>{essay.title}</h2>
          {essay.prompt && (
            <div className="serif italic" style={{ fontSize: 15, lineHeight: 1.55, color: "var(--ink-faint)", paddingLeft: 16, borderLeft: "2px solid var(--line)" }}>
              {essay.prompt}
            </div>
          )}
        </div>
        <div />
      </div>
      <div style={watermark ? { backgroundImage: watermark, backgroundRepeat: "repeat" } : undefined}>
        {paras.map((p, i) => (
          <Para
            key={i}
            text={p}
            note={marginNotes[i]}
            fontPx={fontPx}
            lineH={lineH}
            bodyFont={bodyFont}
            showNotes={showNotes}
            drop={index === 0 && i === 0}
          />
        ))}
      </div>
    </section>
  );
}

// ── Reading settings popover ───────────────────────────────────────────────────
function TypeControls({ s, set }: { s: { size: string; body: string; width: string; notes: boolean }; set: (k: string, v: string | boolean) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-[38px] items-center gap-[7px] rounded-[9px] px-[13px] text-[13px] font-semibold"
        style={{ border: "1px solid " + (open ? "var(--blue-line)" : "var(--line)"), background: open ? "var(--blue-wash)" : "var(--surface)", color: open ? "var(--td-blue)" : "var(--ink-soft)" }}
      >
        <span className="serif text-[16px]">A</span>
        <span className="serif" style={{ fontSize: 11, marginLeft: -3 }}>a</span> Reading
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fixed inset-0 z-[60]" />
          <div
            className="anim-up absolute right-0 top-[46px] z-[61] w-[248px] rounded-[14px] p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
          >
            <CtrlRow label="Text size"><Seg options={[["s", "S"], ["m", "M"], ["l", "L"]]} value={s.size} onChange={(v) => set("size", v)} /></CtrlRow>
            <CtrlRow label="Typeface"><Seg options={[["serif", "Serif"], ["sans", "Sans"]]} value={s.body} onChange={(v) => set("body", v)} /></CtrlRow>
            <CtrlRow label="Width"><Seg options={[["cozy", "Cozy"], ["wide", "Wide"]]} value={s.width} onChange={(v) => set("width", v)} /></CtrlRow>
            <div className="my-3 h-px" style={{ background: "var(--line)" }} />
            <label className="flex cursor-pointer items-center justify-between">
              <span>
                <span className="block text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>Focus mode</span>
                <span className="block text-[11.5px]" style={{ color: "var(--ink-faint)" }}>Hide margin notes</span>
              </span>
              <span
                onClick={(e) => { e.preventDefault(); set("notes", !s.notes); }}
                className="relative h-[23px] w-10 shrink-0 rounded-full"
                style={{ background: s.notes ? "var(--line)" : "var(--td-blue)", transition: "background .2s" }}
              >
                <span className="absolute top-[2px] h-[19px] w-[19px] rounded-full bg-white" style={{ left: s.notes ? 2 : 19, boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s" }} />
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
function CtrlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>{label}</span>
      {children}
    </div>
  );
}
function Seg({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex gap-0.5 rounded-lg p-0.5" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
      {options.map(([v, l]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="rounded-md px-2.5 py-1 text-[12px] font-semibold"
          style={{ background: value === v ? "var(--surface)" : "transparent", color: value === v ? "var(--ink)" : "var(--ink-faint)", boxShadow: value === v ? "var(--shadow-sm)" : "none" }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ── Chapter tabs / footer ──────────────────────────────────────────────────────
function ChapterTabs({ essays, active, onPick }: { essays: ReaderEssay[]; active: number; onPick: (i: number) => void }) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2 pb-2">
      {essays.map((e, i) => {
        const on = active === i;
        return (
          <button
            key={i}
            onClick={() => onPick(i)}
            className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[12.5px] font-semibold"
            style={{ border: "1px solid " + (on ? "var(--ink)" : "var(--line)"), background: on ? "var(--ink)" : "var(--surface)", color: on ? "var(--paper)" : "var(--ink-soft)", transition: "all .15s" }}
          >
            <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{String(i + 1).padStart(2, "0")}</span>
            {e.title}
          </button>
        );
      })}
    </div>
  );
}

function ChapterFooter({ essays, active, onPick }: { essays: ReaderEssay[]; active: number; onPick: (i: number) => void }) {
  const prev = active > 0 ? essays[active - 1] : null;
  const next = active < essays.length - 1 ? essays[active + 1] : null;
  const btn = (side: "left" | "right"): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: side === "right" ? "flex-end" : "flex-start",
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-card)",
    padding: "14px 18px",
    cursor: "pointer",
    minWidth: 0,
  });
  return (
    <div className="mt-14 flex items-stretch gap-3.5 pt-6" style={{ borderTop: "1px solid var(--line)" }}>
      {prev ? (
        <button onClick={() => onPick(active - 1)} style={btn("left")}>
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--ink-faint)" }} />
          <span className="min-w-0 text-left">
            <span className="eyebrow block">Previous</span>
            <span className="serif block truncate text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{prev.title}</span>
          </span>
        </button>
      ) : <div className="flex-1" />}
      <div className="shrink-0 self-center px-1.5 text-center">
        <span className="mono text-[12px]" style={{ color: "var(--ink-faint)" }}>{active + 1} / {essays.length}</span>
      </div>
      {next ? (
        <button onClick={() => onPick(active + 1)} style={btn("right")}>
          <span className="min-w-0 text-right">
            <span className="eyebrow block">Next essay</span>
            <span className="serif block truncate text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{next.title}</span>
          </span>
          <ChevronRight className="h-4 w-4" style={{ color: "var(--td-blue)" }} />
        </button>
      ) : (
        <div className="flex flex-1 items-center justify-end">
          <span className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold" style={{ background: "var(--emerald-wash)", color: "var(--emerald)", border: "1px solid #CCE6DA" }}>
            <CheckCircle className="h-3 w-3" /> End of application
          </span>
        </div>
      )}
    </div>
  );
}

// ── Left chapter rail ──────────────────────────────────────────────────────────
function ChapterRail({ essays, active, goChapter, purchased, progress, colW, readMins }: { essays: ReaderEssay[]; active: number; goChapter: (i: number) => void; purchased: boolean; progress: number; colW: number; readMins: number }) {
  // Start at a fixed width so server and first client render agree (no
  // hydration mismatch); read the real width after mount.
  const [vw, setVw] = useState(1440);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const railW = 188, gap = 40;
  const gutter = (vw - colW) / 2;
  if (gutter < railW + gap + 16) return null;
  const left = gutter - railW - gap + 28;
  return (
    <div className="absolute" style={{ left, top: 40, width: railW }}>
      <div className="sticky" style={{ top: 40 }}>
        <div className="eyebrow mb-3.5">Contents</div>
        <div className="flex flex-col gap-0.5">
          {essays.map((e, i) => {
            const on = active === i;
            const locked = !purchased && i > 0;
            return (
              <button
                key={i}
                onClick={() => !locked && goChapter(i)}
                disabled={locked}
                className="flex items-start gap-[9px] rounded-lg px-1.5 py-[7px] text-left"
                style={{ opacity: locked ? 0.5 : 1, cursor: locked ? "default" : "pointer", borderLeft: "2px solid " + (on ? "var(--td-blue)" : "transparent"), marginLeft: -2 }}
              >
                <span className="mono text-[11px] font-semibold" style={{ color: on ? "var(--td-blue)" : "var(--ink-faint)", marginTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[12.5px]" style={{ fontWeight: on ? 700 : 500, lineHeight: 1.35, color: on ? "var(--ink)" : "var(--ink-soft)" }}>
                  {e.title}
                  {locked && <Lock className="ml-1.5 inline h-2.5 w-2.5 align-middle" style={{ color: "var(--ink-faint)" }} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-[18px] flex items-center gap-[9px] pt-4" style={{ borderTop: "1px solid var(--line)" }}>
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--td-blue) ${progress * 360}deg, var(--line) 0)` }}>
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-bold" style={{ background: "var(--paper)", color: "var(--ink-soft)" }}>{Math.round(progress * 100)}</span>
          </div>
          <span className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>{readMins} min read</span>
        </div>
      </div>
    </div>
  );
}

// ── Frontispiece ───────────────────────────────────────────────────────────────
function Frontispiece({ data }: { data: ReaderData }) {
  return (
    <div className="relative pt-14 text-center">
      <div className="mb-[22px] inline-flex items-center gap-2.5">
        <UniLogo slug={data.university.slug} name={data.university.name} size={30} radius={8} />
        <span className="eyebrow">{data.university.name}{data.admittedYear ? ` · Class of ${data.admittedYear}` : ""}</span>
      </div>
      <h1 className="serif mx-auto font-medium" style={{ fontSize: "clamp(40px, 6vw, 68px)", lineHeight: 1.04, letterSpacing: "-.025em", color: "var(--ink)", maxWidth: 760 }}>
        {data.title}
      </h1>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-[18px]">
        <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ink-soft)" }}><Files className="h-3.5 w-3.5" />{data.essays.length} essay{data.essays.length !== 1 ? "s" : ""}</span>
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--ink-faint)" }} />
        <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--ink-soft)" }}><Clock className="h-3.5 w-3.5" />{data.readMins} min</span>
        <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--ink-faint)" }} />
        <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: "var(--emerald)" }}><CheckCircle className="h-3.5 w-3.5" />Admit-verified</span>
      </div>
      {data.themes.length > 0 && (
        <div className="serif mt-[18px] italic" style={{ fontSize: 15, color: "var(--ink-faint)" }}>
          {data.themes.join("  ·  ")}
        </div>
      )}
      <div className="mx-auto mt-10 h-px w-[60px]" style={{ background: "var(--line)" }} />
    </div>
  );
}

function EditorNote({ text }: { text: string }) {
  return (
    <figure className="mx-auto mt-11 text-center" style={{ maxWidth: 620 }}>
      <div className="mb-4 flex items-center justify-center gap-2.5">
        <span className="h-px w-[30px]" style={{ background: "var(--blue-line)" }} />
        <span className="eyebrow inline-flex items-center gap-1.5" style={{ color: "var(--td-blue)" }}><Sparkles className="h-3 w-3" /> Editor&apos;s note</span>
        <span className="h-px w-[30px]" style={{ background: "var(--blue-line)" }} />
      </div>
      <blockquote className="serif italic" style={{ margin: 0, fontSize: 20, lineHeight: 1.55, color: "var(--ink)", letterSpacing: "-.01em" }}>{text}</blockquote>
    </figure>
  );
}

function WriterNote({ writer }: { writer: { name: string; bio?: string | null; verifiedAdmit?: boolean } }) {
  if (!writer.bio) return null;
  return (
    <div className="mx-auto mt-[72px] rounded-2xl p-[28px]" style={{ maxWidth: 620, background: "var(--paper-2)" }}>
      <div className="mb-3.5 flex items-center gap-[11px]">
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-lg font-bold" style={{ background: "var(--blue-wash)", color: "var(--td-blue)" }}>{writer.name[0]}</span>
        <div>
          <div className="flex items-center gap-1.5 text-[14.5px] font-bold" style={{ color: "var(--ink)" }}>
            {writer.name}
            {writer.verifiedAdmit && <CheckCircle className="h-3.5 w-3.5" style={{ color: "var(--emerald)" }} />}
          </div>
          <div className="eyebrow mt-0.5">The writer · A note for you</div>
        </div>
      </div>
      <p className="serif italic" style={{ margin: 0, fontSize: 17, lineHeight: 1.7, color: "var(--ink-soft)" }}>&ldquo;{writer.bio}&rdquo;</p>
    </div>
  );
}

// ── Unlock gate ────────────────────────────────────────────────────────────────
function UnlockGate({ data }: { data: ReaderData }) {
  const remaining = data.essays.length - 1;
  return (
    <div className="relative" style={{ marginTop: -120, paddingTop: 120 }}>
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-40" style={{ background: "linear-gradient(transparent, var(--paper))" }} />
      <div className="relative mx-auto max-w-[560px] text-center">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)", color: "var(--td-blue)" }}>
          <Lock className="h-[22px] w-[22px]" />
        </div>
        <h3 className="serif mb-2.5 text-[30px] font-medium" style={{ color: "var(--ink)", letterSpacing: "-.02em" }}>You&apos;ve read the opening.</h3>
        <p className="mx-auto mb-[26px] max-w-[420px]" style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ink-soft)" }}>
          Unlock the full application{remaining > 0 ? ` — ${data.essays.length} essays in total` : ""}, with margin notes on exactly what made each one land.
        </p>
        <div className="mx-auto inline-flex flex-col items-center gap-3 rounded-2xl px-[22px] py-3.5" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}>
          <div className="text-center">
            <div className="serif text-[26px] font-semibold" style={{ color: "var(--ink)" }}>{formatCents(data.priceCents)}</div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-faint)" }}>one-time · ₹ via Razorpay</div>
          </div>
          <ApplicationPaywall
            applicationId={data.id}
            applicationSlug={data.slug}
            priceCents={data.priceCents}
            isLoggedIn={data.isLoggedIn}
          />
        </div>
        <div className="mt-[22px] flex items-center justify-center gap-[18px]">
          {[[Shield, "Watermarked to you"], [CheckCircle, "Admit-verified"], [PenLine, "Supports the writer"]].map(([Ic, t], i) => {
            const Icon = Ic as typeof Shield;
            return (
              <span key={i} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--ink-faint)" }}>
                <Icon className="h-3.5 w-3.5" style={{ color: "var(--emerald)" }} />{t as string}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
