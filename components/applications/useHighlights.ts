"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  groupByParagraph,
  mergeIntoExisting,
  paragraphKey,
  type Anchor,
  type HighlightColor,
  type StoredHighlight,
} from "@/lib/highlights/anchor";

type ApiHighlight = StoredHighlight & { createdAt: string };

/**
 * Loads, creates and edits the reader's highlights for one application.
 *
 * Optimistic throughout: marking a passage paints immediately and reconciles
 * when the POST returns. A failed write rolls the paint back rather than
 * leaving a highlight that only exists in this tab.
 */
export function useHighlights({
  applicationId,
  enabled,
}: {
  applicationId: string;
  enabled: boolean;
}) {
  const [items, setItems] = useState<StoredHighlight[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `/api/highlights?applicationId=${encodeURIComponent(applicationId)}`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = (await res.json()) as ApiHighlight[];
        setItems(rows);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[highlights] load failed", err);
        setError("Couldn't load your notes.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [applicationId, enabled]);

  const byParagraph = useMemo(() => groupByParagraph(items), [items]);

  const forParagraph = useCallback(
    (essayIndex: number, paraIndex: number): StoredHighlight[] =>
      byParagraph.get(paragraphKey(essayIndex, paraIndex)) ?? [],
    [byParagraph],
  );

  /** Mark a passage, folding it into anything it already touches. */
  const create = useCallback(
    async (input: {
      anchor: Anchor;
      quote: string;
      color?: HighlightColor;
      paragraphText: string;
    }) => {
      const { anchor, absorbedIds } = mergeIntoExisting(input.anchor, items);
      const quote = input.paragraphText.slice(
        anchor.startOffset,
        anchor.endOffset,
      );
      const color = input.color ?? "yellow";

      const optimisticId = `pending-${Date.now()}`;
      const optimistic: StoredHighlight = {
        ...anchor,
        id: optimisticId,
        quote,
        note: null,
        color,
      };

      setItems((prev) => [
        ...prev.filter((h) => !absorbedIds.includes(h.id)),
        optimistic,
      ]);

      try {
        // Drop the highlights this selection swallowed before writing the
        // widened one, so a reload can't show both.
        await Promise.all(
          absorbedIds.map((id) =>
            fetch(`/api/highlights/${id}`, { method: "DELETE" }),
          ),
        );

        const res = await fetch("/api/highlights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId, ...anchor, quote, color }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          error?: string;
        };
        if (!res.ok || !data.id) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        setItems((prev) =>
          prev.map((h) => (h.id === optimisticId ? { ...h, id: data.id! } : h)),
        );
      } catch (err) {
        console.error("[highlights] create failed", err);
        setItems((prev) => prev.filter((h) => h.id !== optimisticId));
        setError("Couldn't save that highlight.");
      }
    },
    [applicationId, items],
  );

  const update = useCallback(
    async (id: string, patch: { note?: string | null; color?: HighlightColor }) => {
      const previous = items.find((h) => h.id === id);
      if (!previous) return;

      setItems((prev) =>
        prev.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      );

      try {
        const res = await fetch(`/api/highlights/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error("[highlights] update failed", err);
        setItems((prev) => prev.map((h) => (h.id === id ? previous : h)));
        setError("Couldn't save that note.");
      }
    },
    [items],
  );

  const remove = useCallback(
    async (id: string) => {
      const previous = items.find((h) => h.id === id);
      setItems((prev) => prev.filter((h) => h.id !== id));

      try {
        const res = await fetch(`/api/highlights/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.error("[highlights] delete failed", err);
        if (previous) setItems((prev) => [...prev, previous]);
        setError("Couldn't remove that highlight.");
      }
    },
    [items],
  );

  return {
    items,
    loading,
    error,
    clearError: () => setError(null),
    forParagraph,
    create,
    update,
    remove,
  };
}
