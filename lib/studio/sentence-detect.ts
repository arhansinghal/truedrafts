// Sentence-end detection for the Writing Studio.
//
// The editor fires onUpdate on every keystroke; we need a deterministic way to
// turn that into "a new sentence was just completed" events for the right-panel
// suggestion pipeline. Two helpers do this:
//
//   - extractSentences: split text into completed sentences (terminator-bounded)
//   - diffNewSentences: given prev + curr arrays, return only the truly new
//     sentence completions (so we don't re-fire on every keystroke after a `.`)
//
// We intentionally treat abbreviations like "Dr." as separate sentences. The
// downstream classifier (Phase C) will reject non-researchable triggers, so
// false positives here are cheap. False negatives would be invisible bugs.

const SENTENCE_RE = /[^.!?]+[.!?]+/g;

export function extractSentences(text: string): string[] {
  if (!text) return [];
  const matches = text.match(SENTENCE_RE) ?? [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

// Returns sentences from `curr` that are NEW completions vs `prev`.
//
// Two intentional behaviours:
//   1. New trailing sentences (curr.length > prev.length) → fire.
//   2. An earlier sentence that was re-edited then re-terminated → DO NOT fire.
//      The writer is revising; re-suggesting on every revision would spam the
//      panel. They can re-trigger by hitting Enter + retyping if they want.
export function diffNewSentences(prev: string[], curr: string[]): string[] {
  if (curr.length <= prev.length) return [];
  return curr.slice(prev.length);
}
