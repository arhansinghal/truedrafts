"use client";

import { useCallback, type MouseEvent } from "react";
import {
  splitParagraph,
  type Anchor,
  type HighlightColor,
  type StoredHighlight,
} from "@/lib/highlights/anchor";

/** Background wash per colour. Deliberately pale — text legibility comes first. */
const COLOR_WASH: Record<HighlightColor, string> = {
  yellow: "rgba(247, 205, 70, 0.34)",
  blue: "rgba(8, 81, 160, 0.16)",
  green: "rgba(28, 122, 87, 0.18)",
  pink: "rgba(178, 58, 46, 0.16)",
};

/**
 * One paragraph of essay text, with the reader's highlights painted on.
 *
 * Selection is captured here rather than on the page root so the offsets are
 * always relative to this paragraph's own text — no walking the DOM to work out
 * which block a range started in.
 */
export function HighlightableText({
  text,
  essayIndex,
  paraIndex,
  highlights,
  onSelect,
  onOpenHighlight,
  interactive,
}: {
  text: string;
  essayIndex: number;
  paraIndex: number;
  highlights: readonly StoredHighlight[];
  onSelect?: (anchor: Anchor, quote: string, paragraphText: string) => void;
  onOpenHighlight?: (highlight: StoredHighlight) => void;
  interactive: boolean;
}) {
  const handleMouseUp = useCallback(() => {
    if (!interactive || !onSelect) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    const host = document.querySelector(
      `[data-para="${essayIndex}:${paraIndex}"]`,
    );
    if (!host || !host.contains(range.commonAncestorContainer)) return;

    // Character offset of the selection start within this paragraph: the length
    // of everything from the paragraph's start up to the range's start.
    const preRange = range.cloneRange();
    preRange.selectNodeContents(host);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const quote = range.toString();
    const endOffset = startOffset + quote.length;

    if (!quote.trim()) return;

    onSelect(
      { essayIndex, paraIndex, startOffset, endOffset },
      quote,
      text,
    );
    selection.removeAllRanges();
  }, [essayIndex, interactive, onSelect, paraIndex, text]);

  const segments = splitParagraph(text, highlights);

  return (
    <span
      data-para={`${essayIndex}:${paraIndex}`}
      onMouseUp={handleMouseUp}
      style={{ cursor: interactive ? "text" : undefined }}
    >
      {segments.map((segment, i) =>
        segment.highlight ? (
          <mark
            key={`${segment.highlight.id}-${i}`}
            onClick={(event: MouseEvent) => {
              event.stopPropagation();
              onOpenHighlight?.(segment.highlight!);
            }}
            title={segment.highlight.note ?? "Add a note"}
            style={{
              background: COLOR_WASH[segment.highlight.color],
              color: "inherit",
              borderRadius: 2,
              padding: "0 1px",
              cursor: "pointer",
              // A note attached to the highlight earns an underline so it is
              // distinguishable from a bare colour wash at a glance.
              borderBottom: segment.highlight.note
                ? "1.5px solid rgba(20, 35, 59, 0.35)"
                : "none",
            }}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`plain-${i}`}>{segment.text}</span>
        ),
      )}
    </span>
  );
}
