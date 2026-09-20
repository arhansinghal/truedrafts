/**
 * Anchoring highlights to paragraph text.
 *
 * A highlight points at a character range inside one paragraph of one essay:
 * `(essayIndex, paraIndex, startOffset, endOffset)`.
 *
 * **Offsets are `[startOffset, endOffset)`** — start inclusive, end exclusive,
 * exactly like `String.prototype.slice`. Everything in this file obeys that,
 * and so does the `highlights` table. It is the single rule that keeps the
 * browser's Selection API, the database and the renderer agreeing.
 *
 * Pure functions only, so the offset arithmetic can be tested without a DOM.
 */

export type HighlightColor = "yellow" | "blue" | "green" | "pink";

export const HIGHLIGHT_COLORS: readonly HighlightColor[] = [
  "yellow",
  "blue",
  "green",
  "pink",
];

/** Where a highlight sits. */
export type Anchor = {
  essayIndex: number;
  paraIndex: number;
  startOffset: number;
  endOffset: number;
};

/** A stored highlight, as the reader and the notes library see it. */
export type StoredHighlight = Anchor & {
  id: string;
  quote: string;
  note: string | null;
  color: HighlightColor;
};

/** Longest run of text a single highlight may cover. */
export const MAX_QUOTE_LENGTH = 2_000;

/** Longest note a reader may attach. */
export const MAX_NOTE_LENGTH = 2_000;

export function isHighlightColor(value: unknown): value is HighlightColor {
  return (
    value === "yellow" ||
    value === "blue" ||
    value === "green" ||
    value === "pink"
  );
}

/** Shape check for an anchor arriving over the wire. */
export function isWellFormedAnchor(value: unknown): value is Anchor {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    Number.isInteger(a.essayIndex) &&
    Number.isInteger(a.paraIndex) &&
    Number.isInteger(a.startOffset) &&
    Number.isInteger(a.endOffset) &&
    (a.essayIndex as number) >= 0 &&
    (a.paraIndex as number) >= 0 &&
    (a.startOffset as number) >= 0 &&
    (a.endOffset as number) > (a.startOffset as number)
  );
}

/**
 * Pull an anchor back inside a paragraph that may have changed length since the
 * highlight was made.
 *
 * Returns null when nothing survives — a highlight whose paragraph shrank past
 * its start offset has no text left to mark.
 */
export function clampAnchor(anchor: Anchor, paraLength: number): Anchor | null {
  if (paraLength <= 0) return null;

  const startOffset = Math.max(0, Math.min(anchor.startOffset, paraLength));
  const endOffset = Math.max(0, Math.min(anchor.endOffset, paraLength - 1));

  if (endOffset <= startOffset) return null;
  return { ...anchor, startOffset, endOffset };
}

/** The text a highlight covers. */
export function sliceQuote(text: string, anchor: Anchor): string {
  return text.slice(anchor.startOffset, anchor.endOffset);
}

/** Same paragraph of the same essay? */
export function sameParagraph(a: Anchor, b: Anchor): boolean {
  return a.essayIndex === b.essayIndex && a.paraIndex === b.paraIndex;
}

/** Do two anchors in the same paragraph share any characters? */
export function overlaps(a: Anchor, b: Anchor): boolean {
  if (!sameParagraph(a, b)) return false;
  // Half-open ranges touch without overlapping when one ends exactly where the
  // other starts, so these are strict comparisons.
  return a.startOffset < b.endOffset && b.startOffset < a.endOffset;
}

/** Do two anchors sit end-to-end with nothing between them? */
export function adjacent(a: Anchor, b: Anchor): boolean {
  if (!sameParagraph(a, b)) return false;
  return a.endOffset === b.startOffset || b.endOffset === a.startOffset;
}

/**
 * Fold a new selection together with any existing highlights it touches.
 *
 * Dragging across something you already highlighted should widen that
 * highlight, not stack a second one on top of it. Returns the widened anchor
 * plus the ids that were absorbed into it and should now be deleted.
 */
export function mergeIntoExisting(
  selection: Anchor,
  existing: readonly StoredHighlight[],
): { anchor: Anchor; absorbedIds: string[] } {
  let startOffset = selection.startOffset;
  let endOffset = selection.endOffset;
  const absorbedIds: string[] = [];

  for (const candidate of existing) {
    if (!sameParagraph(selection, candidate)) continue;
    if (!overlaps(selection, candidate) && !adjacent(selection, candidate)) {
      continue;
    }
    startOffset = Math.min(startOffset, candidate.startOffset);
    endOffset = Math.max(endOffset, candidate.endOffset);
    absorbedIds.push(candidate.id);
  }

  return {
    anchor: { ...selection, startOffset, endOffset },
    absorbedIds,
  };
}

/** A run of paragraph text, either plain or under a highlight. */
export type Segment = {
  text: string;
  highlight: StoredHighlight | null;
};

/**
 * Cut a paragraph into the runs the renderer draws.
 *
 * Highlights are applied left to right. Anything outside them comes back as a
 * plain segment, so concatenating every `text` reproduces the paragraph.
 */
export function splitParagraph(
  text: string,
  highlights: readonly StoredHighlight[],
): Segment[] {
  if (highlights.length === 0) return [{ text, highlight: null }];

  const ordered = [...highlights].sort(
    (a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset,
  );

  const segments: Segment[] = [];
  let cursor = 0;

  for (const highlight of ordered) {
    if (highlight.startOffset > cursor) {
      segments.push({
        text: text.slice(cursor, highlight.startOffset),
        highlight: null,
      });
    }

    segments.push({
      text: text.slice(highlight.startOffset, highlight.endOffset),
      highlight,
    });
    cursor = highlight.endOffset;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlight: null });
  }

  return segments.filter((segment) => segment.text.length > 0);
}

/** Index highlights by paragraph so the renderer can look them up in O(1). */
export function groupByParagraph(
  highlights: readonly StoredHighlight[],
): Map<string, StoredHighlight[]> {
  const byKey = new Map<string, StoredHighlight[]>();
  for (const highlight of highlights) {
    const key = `${highlight.essayIndex}:${highlight.paraIndex}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(highlight);
    else byKey.set(key, [highlight]);
  }
  return byKey;
}

/** The lookup key `groupByParagraph` uses. */
export function paragraphKey(essayIndex: number, paraIndex: number): string {
  return `${essayIndex}:${paraIndex}`;
}

/**
 * Has the underlying text moved out from under a highlight?
 *
 * A writer editing a published application shifts every offset after the edit.
 * Comparing the stored quote against what currently sits at the anchor is a
 * cheap way to notice, so the UI can show the note without pretending to know
 * where in the text it belongs.
 */
export function hasDrifted(
  anchor: Anchor,
  storedQuote: string,
  currentParagraph: string,
): boolean {
  return sliceQuote(currentParagraph, anchor) !== storedQuote;
}

/** Trim and bound a note. Returns null for an empty one. */
export function normalizeNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_NOTE_LENGTH);
}

/** A short preview of a quote, for the notes library list. */
export function previewQuote(quote: string, maxLength = 140): string {
  const flat = quote.replace(/\s+/g, " ").trim();
  if (flat.length <= maxLength) return flat;
  return `${flat.slice(0, maxLength - 1).trimEnd()}…`;
}
