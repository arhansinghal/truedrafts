"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RatingWidget({ essayId }: { essayId: string }) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!score) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/essays/${essayId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, note }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Rating failed");
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-green-600">Thanks for your rating!</p>;
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setScore(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                (hover || score) >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
              )}
            />
          </button>
        ))}
        {score > 0 && (
          <span className="ml-2 text-sm text-gray-500 self-center">
            {["", "Poor", "Fair", "Good", "Great", "Excellent"][score]}
          </span>
        )}
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (only visible to the writer)"
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
        rows={2}
        maxLength={200}
      />

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <Button
        size="sm"
        className="mt-2 gap-1"
        disabled={!score || loading}
        onClick={submit}
      >
        <Star className="h-3.5 w-3.5" />
        {loading ? "Submitting..." : "Submit Rating"}
      </Button>
    </div>
  );
}
