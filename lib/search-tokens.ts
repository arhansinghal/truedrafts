/**
 * Search tokenization + synonym expansion for the applications ILIKE filter.
 *
 * The vibe search pipeline produces phrases like "ivy league aspirations" or
 * "California higher education institutions" — none of which substring-match
 * an essay body. We need per-word tokens, with common abbreviations expanded
 * (cs → computer_science) and filter-trigger words removed so structural
 * filters (uni / state / region / ivy) don't double-narrow via the text match.
 */

import { STATE_ALIAS_MAP, REGION_ALIAS_MAP } from "./university-lookup";

/** Common English + search-paraphrase words that never carry meaning here. */
const STOPWORDS = new Set([
  "a","an","the","and","or","of","in","at","on","for","to","is","with",
  "that","my","me","we","i","you","this","it","as","by","from","but","into",
  // boilerplate inserted by AI paraphrases
  "essay","essays","application","applications","aspirations","exploration",
  "academic","development","growth","focus","interest","interests","major",
  "college","university","school","schools","student","students","experience",
  "experiences","technology","technical","impact","education","institutions",
  "higher","studies","passion","skills","argumentation","innovation",
  "competition","generation","new",
]);

/**
 * Short-form → canonical expansions. Both the abbreviation and the expanded
 * forms are emitted so ILIKE matches regardless of how the essay was tagged.
 */
const SYNONYMS: Record<string, string[]> = {
  cs: ["computer_science", "computer science"],
  compsci: ["computer_science", "computer science"],
  "comp-sci": ["computer_science", "computer science"],
  bio: ["biology"],
  biomed: ["biomedical", "biology"],
  econ: ["economics"],
  poli: ["political", "politics"],
  polisci: ["political_science", "political science"],
  math: ["mathematics"],
  maths: ["mathematics"],
  stem: ["science", "technology", "engineering", "mathematics"],
  ai: ["artificial_intelligence", "artificial intelligence", "machine_learning", "machine learning"],
  ml: ["machine_learning", "machine learning", "artificial intelligence"],
  nlp: ["natural_language_processing", "natural language processing"],
  premed: ["pre_med", "pre-med", "biology", "chemistry", "medicine"],
  "pre-med": ["premed", "biology", "chemistry", "medicine"],
  prelaw: ["pre_law", "pre-law", "law"],
  ee: ["electrical_engineering", "electrical engineering"],
  me: ["mechanical_engineering", "mechanical engineering"],
  ce: ["civil_engineering", "civil engineering"],
  che: ["chemical_engineering", "chemical engineering"],
  ppe: ["philosophy_politics_economics", "philosophy politics and economics"],
  mba: ["business", "business_administration"],
  ib: ["international_baccalaureate", "international baccalaureate"],
  firstgen: ["first_gen", "first generation", "first-gen"],
  "first-gen": ["first_gen", "first generation"],
  lgbt: ["lgbtq"],
  "lgbtq+": ["lgbtq"],
  robotics: ["robotics"],
  debate: ["debate", "speech_and_debate"],
  mun: ["model_un", "model united nations"],
  "model un": ["model_un"],
  research: ["research"],
};

/**
 * Split a phrase into individual tokens. Keeps underscores intact (so
 * `computer_science` stays one token, matching the AI vocabulary) but splits
 * on whitespace, commas, slashes, etc.
 */
function rawTokens(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .split(/[\s,/\|]+/)
    .map((t) => t.replace(/[^\w\-_]/g, ""))
    .filter(Boolean);
}

/**
 * Tokenize each input phrase, drop stopwords / too-short, and expand known
 * abbreviations. Deduplicates. Filter tokens (structural-filter triggers)
 * are removed so the ILIKE doesn't double-narrow on "california" when we're
 * already hard-filtering to CA unis.
 */
export function expandSearchTokens(
  phrases: string[],
  filterTokens: Set<string> = new Set()
): string[] {
  const out = new Set<string>();
  for (const phrase of phrases) {
    if (!phrase) continue;
    for (const t of rawTokens(phrase)) {
      if (t.length < 2) continue;
      if (STOPWORDS.has(t)) continue;
      if (filterTokens.has(t)) continue;
      out.add(t);
      const syn = SYNONYMS[t];
      if (syn) for (const s of syn) if (!filterTokens.has(s)) out.add(s);
    }
  }
  return Array.from(out);
}

/**
 * Build the set of tokens we should strip from a user's text terms because
 * the same concept is already being applied as a structural (hard) filter.
 * Passing this set to `expandSearchTokens` prevents the text filter from
 * pointlessly narrowing results that the structural filter already handled.
 */
export function buildFilterTokens(opts: {
  uniName?: string;
  uniSlug?: string;
  uniAliases?: string[];
  ivy?: boolean;
  state?: string;   // 2-letter code
  region?: string;  // canonical region
}): Set<string> {
  const tokens = new Set<string>();
  const add = (s: string | undefined) => {
    if (!s) return;
    for (const t of rawTokens(s)) tokens.add(t);
  };

  add(opts.uniName);
  add(opts.uniSlug);
  for (const a of opts.uniAliases ?? []) add(a);

  if (opts.ivy) {
    ["ivy", "ivies", "league"].forEach((t) => tokens.add(t));
  }

  if (opts.state) {
    tokens.add(opts.state.toLowerCase());
    for (const [name, code] of Object.entries(STATE_ALIAS_MAP)) {
      if (code === opts.state.toUpperCase()) add(name);
    }
  }

  if (opts.region) {
    tokens.add(opts.region.toLowerCase());
    for (const [name, region] of Object.entries(REGION_ALIAS_MAP)) {
      if (region === opts.region.toLowerCase()) add(name);
    }
  }

  return tokens;
}
