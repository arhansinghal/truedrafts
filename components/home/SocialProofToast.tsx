"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

const EVENTS = [
  { school: "Harvard",       slug: "harvard",       type: "Common App Essay",  ago: "2 minutes ago" },
  { school: "Stanford",      slug: "stanford",      type: "Why Stanford Essay", ago: "4 minutes ago" },
  { school: "MIT",           slug: "mit",           type: "Supplemental Essay", ago: "7 minutes ago" },
  { school: "Yale",          slug: "yale",          type: "Activities Essay",   ago: "11 minutes ago" },
  { school: "Princeton",     slug: "princeton",     type: "Common App Essay",   ago: "3 minutes ago" },
  { school: "Columbia",      slug: "columbia",      type: "Why School Essay",   ago: "6 minutes ago" },
  { school: "UPenn",         slug: "upenn",         type: "Short Answer",       ago: "9 minutes ago" },
  { school: "UC Berkeley",   slug: "uc-berkeley",   type: "Personal Insight",   ago: "5 minutes ago" },
];

export function SocialProofToast() {
  const [visible, setVisible] = useState(false);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const show = () => setVisible(true);
    const hide = () => setVisible(false);

    // Start first toast after 4s
    const t0 = setTimeout(show, 4000);
    return () => clearTimeout(t0);
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Auto-hide after 4.5s
    const t1 = setTimeout(() => setVisible(false), 4500);
    // Show next after 12s
    const t2 = setTimeout(() => {
      setIdx((i) => (i + 1) % EVENTS.length);
      setVisible(true);
    }, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, idx]);

  const ev = EVENTS[idx];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-6 z-50 pointer-events-none"
      style={{
        transition: "opacity 0.5s ease, transform 0.5s ease",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      <div
        className="bg-white/90 backdrop-blur-xl rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[280px]"
        style={{
          boxShadow: "0 0 0 1px rgba(37,99,235,0.12), 0 8px 32px rgba(0,0,0,0.1), 0 0 0 4px rgba(37,99,235,0.04)",
          border: "1px solid rgba(255,255,255,0.7)",
        }}
      >
        {/* Logo */}
        <div className="w-9 h-9 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
          <Image
            src={`/uni_logos/${ev.slug}.png`}
            alt={ev.school}
            width={28}
            height={28}
            className="object-contain p-0.5"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-800 leading-snug">
            Someone just unlocked a{" "}
            <span className="text-[#0851A0] font-semibold">{ev.school}</span>{" "}
            {ev.type}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">{ev.ago}</p>
        </div>
      </div>
    </div>
  );
}
