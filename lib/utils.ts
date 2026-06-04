import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cents here are INR paise. Render as ₹ with Indian-grouping commas. Drops the
// decimal when there are 0 paise (the common case), keeps two decimals otherwise.
export function formatCents(cents: number): string {
  const rupees = cents / 100;
  const fractionDigits = Number.isInteger(rupees) ? 0 : 2;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim() +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export function computePreview(content: string, percent = 0.25): string {
  const words = content.split(/\s+/);
  const previewWords = Math.floor(words.length * percent);
  return words.slice(0, previewWords).join(" ");
}

export function generateReferralCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function essayTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    common_app: "Common App",
    supplemental: "Supplemental",
    why_school: "Why School",
    activities: "Activities",
    short_answer: "Short Answer",
    other: "Other",
  };
  return labels[type] ?? type;
}

export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
