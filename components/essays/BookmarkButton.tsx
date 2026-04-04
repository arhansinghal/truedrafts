"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function BookmarkButton({ essayId, isLoggedIn }: { essayId: string; isLoggedIn: boolean }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch(`/api/essays/${essayId}/bookmark`)
      .then((r) => r.json())
      .then((d) => setBookmarked(d.bookmarked ?? false))
      .catch(() => {});
  }, [essayId, isLoggedIn]);

  async function toggle() {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=${window.location.pathname}`;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/essays/${essayId}/bookmark`, { method: "POST" });
      const d = await res.json();
      if (res.ok) setBookmarked(d.bookmarked);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={cn("gap-1.5", bookmarked && "border-[#0851A0] text-[#0851A0] bg-[#e8f1fa]")}
    >
      <Bookmark className={cn("h-4 w-4", bookmarked && "fill-current")} />
      {bookmarked ? "Saved" : "Save"}
    </Button>
  );
}
