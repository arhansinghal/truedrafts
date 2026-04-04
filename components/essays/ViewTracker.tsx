"use client";
import { useEffect } from "react";

export function ViewTracker({ essayId }: { essayId: string }) {
  useEffect(() => {
    fetch(`/api/essays/${essayId}/view`, { method: "POST" }).catch(() => {});
  }, [essayId]);
  return null;
}
