// Reading-time estimates for essay cards and detail pages.
//
// Admissions essays are short (150–650 words) and are read slowly — usually
// twice — so the conventional 200 wpm "news article" figure under-reports the
// time a buyer actually spends. We use 180 wpm and always round UP to a whole
// minute: "0 min read" looks like a bug, and over-promising the time costs us
// nothing while under-promising feels like a bait.

/** Words per minute behind every estimate in the UI. */
export const WORDS_PER_MINUTE = 180;

/**
 * Whole minutes to read `wordCount` words, never below 1.
 *
 * Bad input (a NULL word_count widened into NaN, a negative from a bad import)
 * degrades to 1 instead of throwing — this value only drives a label, and a
 * crashed essay card is far worse than a slightly wrong minute count.
 */
export function readingTimeMinutes(
  wordCount: number,
  wpm: number = WORDS_PER_MINUTE,
): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 1;
  if (!Number.isFinite(wpm) || wpm <= 0) return 1;
  return Math.max(1, Math.ceil(wordCount / wpm));
}

/** The exact string rendered on cards: "3 min read". */
export function formatReadingTime(
  wordCount: number,
  wpm: number = WORDS_PER_MINUTE,
): string {
  return `${readingTimeMinutes(wordCount, wpm)} min read`;
}

/**
 * Word count for text with no stored `word_count` (studio drafts, previews).
 * Whitespace-only and empty strings count as 0 — `"".split(/\s+/)` yields
 * `[""]`, which would otherwise report one phantom word.
 */
export function countWords(text: string): number {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
