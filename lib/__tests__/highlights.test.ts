import { describe, it, expect } from "vitest";
import {
  MAX_NOTE_LENGTH,
  adjacent,
  clampAnchor,
  groupByParagraph,
  hasDrifted,
  isHighlightColor,
  isWellFormedAnchor,
  mergeIntoExisting,
  normalizeNote,
  overlaps,
  paragraphKey,
  previewQuote,
  sameParagraph,
  sliceQuote,
  splitParagraph,
  type Anchor,
  type StoredHighlight,
} from "../highlights/anchor";

const PARA =
  "I rebuilt the robot three times before it worked, and the third one still smelled faintly of solder.";

function anchor(
  startOffset: number,
  endOffset: number,
  essayIndex = 0,
  paraIndex = 0,
): Anchor {
  return { essayIndex, paraIndex, startOffset, endOffset };
}

let seq = 0;
function stored(
  startOffset: number,
  endOffset: number,
  overrides: Partial<StoredHighlight> = {},
): StoredHighlight {
  seq += 1;
  return {
    id: `h-${seq}`,
    essayIndex: 0,
    paraIndex: 0,
    startOffset,
    endOffset,
    quote: PARA.slice(startOffset, endOffset),
    note: null,
    color: "yellow",
    ...overrides,
  };
}

describe("isHighlightColor", () => {
  it("accepts the four colours we ship", () => {
    expect(isHighlightColor("yellow")).toBe(true);
    expect(isHighlightColor("blue")).toBe(true);
    expect(isHighlightColor("green")).toBe(true);
    expect(isHighlightColor("pink")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isHighlightColor("chartreuse")).toBe(false);
    expect(isHighlightColor(null)).toBe(false);
    expect(isHighlightColor(3)).toBe(false);
  });
});

describe("isWellFormedAnchor", () => {
  it("accepts a sane anchor", () => {
    expect(isWellFormedAnchor(anchor(0, 5))).toBe(true);
    expect(isWellFormedAnchor(anchor(10, 40, 2, 7))).toBe(true);
  });

  it("rejects an empty or inverted range", () => {
    expect(isWellFormedAnchor(anchor(5, 5))).toBe(false);
    expect(isWellFormedAnchor(anchor(9, 4))).toBe(false);
  });

  it("rejects negative or fractional offsets", () => {
    expect(isWellFormedAnchor(anchor(-1, 5))).toBe(false);
    expect(isWellFormedAnchor({ ...anchor(0, 5), paraIndex: -1 })).toBe(false);
    expect(isWellFormedAnchor({ ...anchor(0, 5), startOffset: 1.5 })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isWellFormedAnchor(null)).toBe(false);
    expect(isWellFormedAnchor("0,5")).toBe(false);
    expect(isWellFormedAnchor({})).toBe(false);
  });
});

describe("sliceQuote", () => {
  it("returns exactly the covered text", () => {
    expect(sliceQuote(PARA, anchor(0, 9))).toBe("I rebuilt");
    expect(sliceQuote(PARA, anchor(10, 19))).toBe("the robot");
  });

  it("is consistent with String.slice", () => {
    expect(sliceQuote(PARA, anchor(4, 30))).toBe(PARA.slice(4, 30));
  });
});

describe("clampAnchor", () => {
  it("leaves an anchor comfortably inside the paragraph alone", () => {
    const result = clampAnchor(anchor(10, 30), PARA.length);
    expect(result).toEqual(anchor(10, 30));
  });

  it("pulls an over-long anchor back inside the paragraph", () => {
    const result = clampAnchor(anchor(5, 5_000), PARA.length);
    expect(result).not.toBe(null);
    expect(result!.startOffset).toBe(5);
    expect(result!.endOffset).toBeLessThanOrEqual(PARA.length);
    expect(result!.endOffset).toBeGreaterThan(result!.startOffset);
  });

  it("gives up when the paragraph shrank past the start", () => {
    expect(clampAnchor(anchor(90, 99), 12)).toBe(null);
  });

  it("gives up on an empty paragraph", () => {
    expect(clampAnchor(anchor(0, 5), 0)).toBe(null);
  });

  it("keeps the essay and paragraph indexes", () => {
    const result = clampAnchor(anchor(2, 8, 3, 4), PARA.length);
    expect(result!.essayIndex).toBe(3);
    expect(result!.paraIndex).toBe(4);
  });
});

describe("sameParagraph / overlaps / adjacent", () => {
  it("only compares within one paragraph", () => {
    expect(sameParagraph(anchor(0, 5, 0, 0), anchor(0, 5, 0, 1))).toBe(false);
    expect(sameParagraph(anchor(0, 5, 0, 0), anchor(0, 5, 1, 0))).toBe(false);
    expect(sameParagraph(anchor(0, 5, 2, 3), anchor(9, 12, 2, 3))).toBe(true);
  });

  it("treats half-open ranges that merely touch as not overlapping", () => {
    expect(overlaps(anchor(0, 10), anchor(10, 20))).toBe(false);
    expect(adjacent(anchor(0, 10), anchor(10, 20))).toBe(true);
  });

  it("detects a genuine overlap either way round", () => {
    expect(overlaps(anchor(0, 12), anchor(10, 20))).toBe(true);
    expect(overlaps(anchor(10, 20), anchor(0, 12))).toBe(true);
  });

  it("detects containment", () => {
    expect(overlaps(anchor(0, 40), anchor(10, 20))).toBe(true);
  });

  it("never overlaps across paragraphs", () => {
    expect(overlaps(anchor(0, 40, 0, 0), anchor(10, 20, 0, 1))).toBe(false);
  });
});

describe("mergeIntoExisting", () => {
  it("leaves a selection that touches nothing alone", () => {
    const { anchor: merged, absorbedIds } = mergeIntoExisting(anchor(50, 60), [
      stored(0, 10),
    ]);
    expect(merged.startOffset).toBe(50);
    expect(merged.endOffset).toBe(60);
    expect(absorbedIds).toEqual([]);
  });

  it("widens over an overlapping highlight and absorbs it", () => {
    const existing = stored(5, 20);
    const { anchor: merged, absorbedIds } = mergeIntoExisting(
      anchor(15, 40),
      [existing],
    );
    expect(merged.startOffset).toBe(5);
    expect(merged.endOffset).toBe(40);
    expect(absorbedIds).toEqual([existing.id]);
  });

  it("swallows a highlight it fully contains", () => {
    const existing = stored(15, 20);
    const { anchor: merged, absorbedIds } = mergeIntoExisting(
      anchor(0, 40),
      [existing],
    );
    expect(merged.startOffset).toBe(0);
    expect(merged.endOffset).toBe(40);
    expect(absorbedIds).toEqual([existing.id]);
  });

  it("joins up an adjacent highlight", () => {
    const existing = stored(0, 10);
    const { anchor: merged, absorbedIds } = mergeIntoExisting(
      anchor(10, 25),
      [existing],
    );
    expect(merged.startOffset).toBe(0);
    expect(merged.endOffset).toBe(25);
    expect(absorbedIds).toEqual([existing.id]);
  });

  it("absorbs several at once", () => {
    const a = stored(0, 10);
    const b = stored(12, 18);
    const { anchor: merged, absorbedIds } = mergeIntoExisting(anchor(5, 30), [
      a,
      b,
    ]);
    expect(merged.startOffset).toBe(0);
    expect(merged.endOffset).toBe(30);
    expect(absorbedIds).toHaveLength(2);
  });

  it("ignores highlights in other paragraphs", () => {
    const other = stored(0, 90, { paraIndex: 1 });
    const { anchor: merged, absorbedIds } = mergeIntoExisting(anchor(5, 30), [
      other,
    ]);
    expect(merged.startOffset).toBe(5);
    expect(absorbedIds).toEqual([]);
  });
});

describe("splitParagraph", () => {
  it("returns the whole paragraph when nothing is highlighted", () => {
    const segments = splitParagraph(PARA, []);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe(PARA);
    expect(segments[0].highlight).toBe(null);
  });

  it("cuts a single highlight out of the middle", () => {
    const segments = splitParagraph(PARA, [stored(10, 19)]);
    expect(segments).toHaveLength(3);
    expect(segments[0].highlight).toBe(null);
    expect(segments[1].text).toBe("the robot");
    expect(segments[1].highlight).not.toBe(null);
    expect(segments[2].highlight).toBe(null);
  });

  it("reproduces the paragraph when the pieces are rejoined", () => {
    const segments = splitParagraph(PARA, [stored(0, 9), stored(20, 31)]);
    expect(segments.map((s) => s.text).join("")).toBe(PARA);
  });

  it("handles a highlight that starts at the very beginning", () => {
    const segments = splitParagraph(PARA, [stored(0, 9)]);
    expect(segments[0].text).toBe("I rebuilt");
    expect(segments[0].highlight).not.toBe(null);
  });

  it("applies highlights left to right regardless of input order", () => {
    const later = stored(20, 31);
    const earlier = stored(0, 9);
    const segments = splitParagraph(PARA, [later, earlier]);
    expect(segments[0].text).toBe("I rebuilt");
  });

  it("drops empty segments", () => {
    const segments = splitParagraph(PARA, [stored(0, 9), stored(9, 19)]);
    expect(segments.every((s) => s.text.length > 0)).toBe(true);
  });
});

describe("groupByParagraph", () => {
  it("buckets by essay and paragraph", () => {
    const grouped = groupByParagraph([
      stored(0, 5),
      stored(10, 15),
      stored(0, 5, { paraIndex: 1 }),
      stored(0, 5, { essayIndex: 1 }),
    ]);
    expect(grouped.get(paragraphKey(0, 0))).toHaveLength(2);
    expect(grouped.get(paragraphKey(0, 1))).toHaveLength(1);
    expect(grouped.get(paragraphKey(1, 0))).toHaveLength(1);
    expect(grouped.get(paragraphKey(9, 9))).toBeUndefined();
  });
});

describe("hasDrifted", () => {
  it("is false while the text still matches", () => {
    const a = anchor(10, 19);
    expect(hasDrifted(a, sliceQuote(PARA, a), PARA)).toBe(false);
  });

  it("is true once the paragraph has been edited underneath", () => {
    const a = anchor(10, 19);
    const quote = sliceQuote(PARA, a);
    expect(hasDrifted(a, quote, `Actually, ${PARA}`)).toBe(true);
  });
});

describe("normalizeNote", () => {
  it("trims and keeps a real note", () => {
    expect(normalizeNote("  good hook  ")).toBe("good hook");
  });

  it("returns null for nothing useful", () => {
    expect(normalizeNote("")).toBe(null);
    expect(normalizeNote("    ")).toBe(null);
    expect(normalizeNote(null)).toBe(null);
    expect(normalizeNote(42)).toBe(null);
  });

  it("bounds an overlong note", () => {
    const long = "x".repeat(MAX_NOTE_LENGTH + 500);
    expect(normalizeNote(long)?.length).toBe(MAX_NOTE_LENGTH);
  });
});

describe("previewQuote", () => {
  it("collapses whitespace", () => {
    expect(previewQuote("a\n\n  b   c")).toBe("a b c");
  });

  it("leaves a short quote whole", () => {
    expect(previewQuote("short enough")).toBe("short enough");
  });

  it("ellipsises a long one", () => {
    const preview = previewQuote("y".repeat(400), 50);
    expect(preview).toHaveLength(50);
    expect(preview.endsWith("…")).toBe(true);
  });
});
