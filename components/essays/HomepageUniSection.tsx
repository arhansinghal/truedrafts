"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { TypewriterPreview } from "./TypewriterPreview";
import type { University } from "@/lib/db/schema";

interface HomepageUniSectionProps {
  universities: University[];
}

interface PreviewEssay {
  id: string;
  slug: string;
  title: string;
  previewContent: string;
  priceCents: number;
  essayType: string;
}

// Color map keyed on first letter of university name
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
  return UNI_LETTER_COLOR[name[0].toUpperCase()] ?? "bg-gray-500";
}

// Shorten long names for pill display
function shortName(name: string): string {
  return name
    .replace(" University", "")
    .replace(" College", "")
    .replace("Massachusetts Institute of Technology", "MIT");
}

export function HomepageUniSection({ universities }: HomepageUniSectionProps) {
  const [selectedUni, setSelectedUni] = useState<University | null>(null);
  const [previewEssay, setPreviewEssay] = useState<PreviewEssay | null>(null);
  const [loadingEssay, setLoadingEssay] = useState(false);

  async function handleUniClick(uni: University) {
    if (selectedUni?.id === uni.id) {
      setSelectedUni(null);
      setPreviewEssay(null);
      return;
    }
    setSelectedUni(uni);
    setPreviewEssay(null);
    setLoadingEssay(true);
    try {
      const res = await fetch(`/api/universities/${uni.id}/sample-essay`);
      if (res.ok) {
        const data = await res.json();
        setPreviewEssay(data);
      }
    } finally {
      setLoadingEssay(false);
    }
  }

  return (
    <div>
      {/* University pill row */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
        {universities.map((uni) => {
          const selected = selectedUni?.id === uni.id;
          const color = uniColor(uni.name);
          return (
            <button
              key={uni.id}
              onClick={() => handleUniClick(uni)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                selected
                  ? "border-[#0851A0] bg-[#e8f1fa] text-[#0851A0] shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-[#0851A0]/40 hover:shadow-sm"
              )}
            >
              {uni.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={uni.logoUrl}
                  alt={uni.name}
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain rounded-full"
                />
              ) : (
                <span
                  className={cn(
                    "inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    color
                  )}
                >
                  {uni.name[0]}
                </span>
              )}
              <span>{shortName(uni.name)}</span>
            </button>
          );
        })}
      </div>

      {/* Preview area */}
      {selectedUni && (
        <div className="flex justify-center">
          {loadingEssay && (
            <div className="w-full max-w-2xl animate-pulse rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
              <div className="mb-4 flex gap-2">
                <div className="h-5 w-24 rounded-full bg-gray-100" />
                <div className="h-5 w-20 rounded-full bg-gray-100" />
                <div className="ml-auto h-5 w-16 rounded-full bg-gray-100" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-gray-100" />
                <div className="h-3 w-5/6 rounded bg-gray-100" />
                <div className="h-3 w-4/6 rounded bg-gray-100" />
                <div className="h-3 w-3/4 rounded bg-gray-100" />
              </div>
            </div>
          )}
          {!loadingEssay && previewEssay && (
            <TypewriterPreview
              text={previewEssay.previewContent.slice(0, 300)}
              essaySlug={previewEssay.slug}
              university={selectedUni.name}
              essayType={previewEssay.essayType}
              price={previewEssay.priceCents}
            />
          )}
          {!loadingEssay && !previewEssay && (
            <p className="text-sm text-gray-400">
              No essays available for {selectedUni.name} yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
