"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { essayTypeLabel } from "@/lib/utils";

interface TypewriterPreviewProps {
  text: string;
  essaySlug: string;
  university: string;
  essayType: string;
  price: number;
  speed?: number;
}

const UNI_LETTER_COLOR: Record<string, string> = {
  H: "bg-red-600",
  M: "bg-gray-800",
  S: "bg-red-700",
  Y: "bg-blue-700",
  P: "bg-orange-500",
  C: "bg-blue-600",
  U: "bg-red-500",
  D: "bg-blue-800",
  N: "bg-purple-700",
  V: "bg-yellow-600",
};

function uniColor(name: string): string {
  return UNI_LETTER_COLOR[name[0]?.toUpperCase()] ?? "bg-gray-500";
}

export function TypewriterPreview({
  text,
  essaySlug,
  university,
  essayType,
  price,
  speed = 30,
}: TypewriterPreviewProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i >= text.length) {
        setDone(true);
        clearInterval(interval);
        return;
      }
      setDisplayed((prev) => prev + text[i]);
      i++;
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  const color = uniColor(university);

  return (
    <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-md overflow-hidden">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-6 py-4">
        <span
          className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}
        >
          {university[0]}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {university}
        </span>
        <span className="rounded-full bg-[#e8f1fa] px-2.5 py-0.5 text-xs font-medium text-[#0851A0]">
          {essayTypeLabel(essayType)}
        </span>
        <span className="ml-auto text-sm font-semibold text-[#0851A0]">
          ${(price / 100).toFixed(2)} to unlock
        </span>
      </div>

      {/* Typewriter text */}
      <div className="px-6 pt-5 pb-0 min-h-[100px]">
        <p className="essay-protected font-serif text-sm leading-relaxed text-gray-800">
          {displayed}
          {!done && (
            <span className="inline-block w-[2px] h-[1em] bg-gray-700 animate-pulse ml-[1px] align-middle" />
          )}
        </p>
      </div>

      {/* Blurred preview + fade */}
      <div className="relative px-6 py-2">
        <p className="font-serif text-sm leading-relaxed text-gray-300 blur-sm select-none">
          and continued to describe the most profound experience of my life, one that shaped my view
          of the world and my place in it forever...
        </p>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 70%, rgba(255,255,255,1) 100%)",
          }}
        />
      </div>

      {/* Unlock CTA */}
      <div className="px-6 pb-6 pt-2">
        <Link href={`/essays/${essaySlug}`} className="block">
          <Button
            className="w-full gap-2 bg-[#0851A0] text-white hover:bg-[#063d85]"
            style={{ background: "#0851A0" }}
          >
            <Lock className="h-4 w-4" />
            Unlock Full Essay
          </Button>
        </Link>
      </div>
    </div>
  );
}
