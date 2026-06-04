import { describe, it, expect } from "vitest";
import { extractSentences, diffNewSentences } from "../studio/sentence-detect";

describe("extractSentences", () => {
  it("returns empty for empty input", () => {
    expect(extractSentences("")).toEqual([]);
  });

  it("ignores text with no terminator", () => {
    expect(extractSentences("hello world")).toEqual([]);
  });

  it("splits a single terminated sentence", () => {
    expect(extractSentences("Hello world.")).toEqual(["Hello world."]);
  });

  it("splits multiple sentences", () => {
    expect(extractSentences("Hi. Bye.")).toEqual(["Hi.", "Bye."]);
  });

  it("handles question marks and exclamations", () => {
    expect(extractSentences("Why? Stop!")).toEqual(["Why?", "Stop!"]);
  });

  it("groups consecutive terminators with their sentence", () => {
    expect(extractSentences("Wait!!!")).toEqual(["Wait!!!"]);
  });

  it("treats abbreviations as separate sentences (acceptable false positive)", () => {
    // Dr. is split off — the Phase C classifier filters these out.
    expect(extractSentences("Dr. Smith arrived.")).toEqual(["Dr.", "Smith arrived."]);
  });

  it("ignores trailing fragment without terminator", () => {
    expect(extractSentences("Done. Now writing")).toEqual(["Done."]);
  });
});

describe("diffNewSentences", () => {
  it("returns nothing when curr <= prev", () => {
    expect(diffNewSentences(["A."], ["A."])).toEqual([]);
    expect(diffNewSentences(["A.", "B."], ["A."])).toEqual([]);
  });

  it("returns trailing additions", () => {
    expect(diffNewSentences([], ["A."])).toEqual(["A."]);
    expect(diffNewSentences(["A."], ["A.", "B."])).toEqual(["B."]);
    expect(diffNewSentences(["A."], ["A.", "B.", "C."])).toEqual(["B.", "C."]);
  });

  it("does not re-fire on revision of earlier sentence", () => {
    // Writer edited the first sentence and re-terminated. Should NOT re-fire.
    expect(diffNewSentences(["A.", "B."], ["A revised.", "B."])).toEqual([]);
  });

  it("fires only the genuinely new tail when length grows", () => {
    expect(diffNewSentences(["A.", "B."], ["A revised.", "B.", "C."])).toEqual(["C."]);
  });
});
