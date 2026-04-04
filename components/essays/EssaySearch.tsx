"use client";
import { useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export function EssaySearch({ currentSearch }: { currentSearch?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(currentSearch ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (v.trim()) {
        params.set("q", v.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    }, 400);
  }

  function handleClear() {
    setValue("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="relative flex items-center w-full max-w-xl"
      style={{
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "9999px",
        border: value ? "1.5px solid #0851A0" : "1.5px solid #e5e7eb",
        boxShadow: value
          ? "0 0 0 3px rgba(8,81,160,0.08)"
          : "0 2px 8px rgba(0,0,0,0.06)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      <Search className="absolute left-4 w-4 h-4 text-gray-400 pointer-events-none shrink-0" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Search essays by topic, prompt, school…"
        className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 py-2.5 pl-10 pr-10 focus:outline-none rounded-full"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
