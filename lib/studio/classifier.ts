// Researchable-claim classifier.
//
// We only want to spend a Voyage embed + Haiku call on sentences that benefit
// from grounded completion. Personal narrative ("when I was twelve...") should
// never trigger — it ruins authenticity and burns money.
//
// Heuristic only for v1. Two pass:
//   1. SKIP if the sentence reads as personal narrative / emotion.
//   2. TRIGGER if it contains a research/inquiry verb + a proper noun, OR
//      ends with a "trailing opener" preposition that implies completion is
//      desired ("interested in working with").
//
// The output also returns a topicHint (extracted noun phrase) to bias retrieval.

// Personal-narrative gate. Keep verbs here clearly emotional/memory-flavored —
// generic "I am" / "I was" would over-block ("I am drawn to the AI lab..." is
// research, not narrative).
const NARRATIVE_LEAD_RE = /^\s*(i\s+(felt|remember|used\s+to|love|hate|miss|grew\s+up|cried|laughed|dreamed)|when\s+i\s+(was|first)|growing\s+up|my\s+(mom|dad|mother|father|grandmother|grandfather|brother|sister|family|childhood))/i;

const RESEARCH_VERBS = [
  "research", "researching", "study", "studying", "explore", "exploring",
  "investigate", "investigating", "work", "working", "build", "building",
  "develop", "developing", "examine", "examining", "analyze", "analyzing",
  "pursue", "pursuing", "join", "joining", "contribute", "contributing",
  "collaborate", "collaborating", "lab", "labs", "professor", "professors",
  "department", "program", "course", "courses", "major", "majoring",
  "specializ", // matches specialize, specializing, specialization, etc.
  "concentrat",
];

const TRAILING_OPENERS_RE = /\b(with|at|from|by|on|under|alongside|including|such\s+as|like|specifically|particularly)\.?\s*$/i;

const STOPWORDS = new Set([
  "the","a","an","of","in","on","at","to","for","and","or","but","with","by",
  "from","as","is","are","was","were","be","been","being","i","my","me","mine",
  "you","your","we","our","us","they","their","them","this","that","these",
  "those","it","its",
]);

export type ClassifyResult = {
  researchable: boolean;
  topicHint: string;
  reason: string;
};

export function classifySentence(sentence: string): ClassifyResult {
  const s = sentence.trim();
  if (s.length < 12) {
    return { researchable: false, topicHint: "", reason: "too_short" };
  }

  if (NARRATIVE_LEAD_RE.test(s)) {
    return { researchable: false, topicHint: "", reason: "personal_narrative" };
  }

  const lower = s.toLowerCase();
  const hasResearchVerb = RESEARCH_VERBS.some((v) => lower.includes(v));
  const properNouns = extractProperNouns(s);
  const trailingOpener = TRAILING_OPENERS_RE.test(s);

  // Trigger conditions:
  //   (a) trailing opener + at least one proper noun → e.g. "research agritech at Stanford with"
  //   (b) research verb + proper noun
  //   (c) trailing opener + research verb anywhere (even without proper noun)
  if ((trailingOpener && properNouns.length > 0) || (hasResearchVerb && properNouns.length > 0)) {
    return {
      researchable: true,
      topicHint: buildTopicHint(s, properNouns),
      reason: trailingOpener ? "trailing_opener_with_proper_noun" : "research_verb_with_proper_noun",
    };
  }
  if (trailingOpener && hasResearchVerb) {
    return {
      researchable: true,
      topicHint: buildTopicHint(s, properNouns),
      reason: "trailing_opener_with_research_verb",
    };
  }

  return { researchable: false, topicHint: "", reason: "no_signal" };
}

function extractProperNouns(s: string): string[] {
  // Tokens with capital initial that are NOT the first word of a sentence.
  // Naive but cheap.
  const tokens = s.replace(/[.!?,;:"'()]/g, " ").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t) continue;
    const first = t[0];
    if (i === 0) continue; // skip sentence-start
    if (first >= "A" && first <= "Z" && !STOPWORDS.has(t.toLowerCase())) {
      out.push(t);
    }
  }
  return out;
}

function buildTopicHint(s: string, properNouns: string[]): string {
  // Top 2 proper nouns + the dominant content nouns. Returned as a short query
  // string used to bias embedding retrieval.
  const lower = s.toLowerCase();
  const contentTokens = lower
    .replace(/[.!?,;:"'()]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 3 && !STOPWORDS.has(t));
  const seen = new Set<string>();
  const topic: string[] = [];
  for (const p of properNouns) {
    const k = p.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      topic.push(p);
    }
  }
  for (const t of contentTokens) {
    if (topic.length >= 6) break;
    if (!seen.has(t)) {
      seen.add(t);
      topic.push(t);
    }
  }
  return topic.join(" ");
}
