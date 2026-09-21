import { describe, it, expect } from "vitest";
import {
  WORDS_PER_MINUTE,
  countWords,
  formatReadingTime,
  readingTimeMinutes,
} from "@/lib/reading-time";

describe("readingTimeMinutes", () => {
  it("rounds up to the next whole minute", () => {
    expect(readingTimeMinutes(WORDS_PER_MINUTE)).toBe(1);
    expect(readingTimeMinutes(WORDS_PER_MINUTE + 1)).toBe(2);
    expect(readingTimeMinutes(WORDS_PER_MINUTE * 3)).toBe(3);
  });

  it("floors at one minute for short and empty essays", () => {
    expect(readingTimeMinutes(0)).toBe(1);
    expect(readingTimeMinutes(1)).toBe(1);
    expect(readingTimeMinutes(150)).toBe(1);
  });

  it("degrades to one minute on bad input instead of throwing", () => {
    expect(readingTimeMinutes(NaN)).toBe(1);
    expect(readingTimeMinutes(-500)).toBe(1);
    expect(readingTimeMinutes(Infinity)).toBe(1);
    expect(readingTimeMinutes(600, 0)).toBe(1);
    expect(readingTimeMinutes(600, NaN)).toBe(1);
  });

  it("honours a custom words-per-minute", () => {
    expect(readingTimeMinutes(600, 300)).toBe(2);
  });
});

describe("formatReadingTime", () => {
  it("renders the card label", () => {
    expect(formatReadingTime(650)).toBe("4 min read");
    expect(formatReadingTime(0)).toBe("1 min read");
  });
});

describe("countWords", () => {
  it("counts words separated by any whitespace run", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("one   two\nthree\tfour")).toBe(4);
  });

  it("reports zero for empty and whitespace-only text", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });
});
