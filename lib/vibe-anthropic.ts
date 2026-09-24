import { chatJson, chatText, isModelAvailable } from "./llm";
import { buildAliasPromptSnippet } from "./university-lookup";

/**
 * Quality-sensitive model for tagging + insight briefs (Claude Haiku by default).
 * These outputs drive search recall and the purchase-preview UI, so we keep
 * them on the higher-quality provider. Override via ANTHROPIC_VIBE_MODEL.
 */
const DEFAULT_VIBE_MODEL =
  process.env.ANTHROPIC_VIBE_MODEL ?? "claude-haiku-4-5-20251001";

/**
 * Cheap model for hot-path / structured-extraction calls (search query parsing,
 * relevance ranking, single-sentence highlight). DeepSeek by default — ~5×
 * cheaper than Haiku with comparable JSON-output quality. Override via
 * VIBE_FAST_MODEL.
 */
const DEFAULT_FAST_MODEL =
  process.env.VIBE_FAST_MODEL ?? "deepseek-chat";

/** Ivy League members that exist in our seed (MIT/Stanford are not Ivy). */
export const IVY_UNIVERSITY_SLUGS = [
  "harvard",
  "yale",
  "princeton",
  "columbia",
  "upenn",
  "brown",
  "cornell",
  "dartmouth",
] as const;

// ─── Canonical activity vocabulary ───────────────────────────────────────────
// AI must normalize activities to these tokens (no variants like "debate team").
const ACTIVITY_VOCABULARY = `
Sports: football, basketball, soccer, tennis, swimming, track_and_field, cross_country, volleyball, baseball, softball, lacrosse, rowing, wrestling, golf, gymnastics, dance, cheerleading, hockey, fencing, squash, water_polo, skiing, running
Academic: debate, model_un, mock_trial, quiz_bowl, science_olympiad, math_olympiad, academic_decathlon, speech_and_debate, policy_debate, lincoln_douglas, mun
STEM: robotics, coding, programming, research, machine_learning, data_science, biology_research, chemistry_research, physics, engineering, mathematics, statistics, neuroscience, hackathon, computer_science
Arts: theater, drama, music, orchestra, band, choir, singing, jazz, visual_art, painting, sculpture, photography, film, creative_writing, poetry, improv, performance_art
Leadership: student_government, class_president, community_service, volunteering, mentorship, tutoring, nonprofit, activism, social_justice
Cultural: first_gen, immigrant, heritage, cultural_identity, bilingual, international, lgbtq
Other: entrepreneurship, business, journalism, newspaper, yearbook, religious_community, environmental_activism, medical_volunteering, hospital_volunteering, athletics
`.trim();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EssayVibeMetadata {
  tone: string;
  core_values: string[];
  narrative_arc: string;
  vibe_summary: string;
  themes: string[];
  /** Inferred intended / declared major (e.g. "Computer Science"), or null if unclear */
  major: string | null;
  /** Extracurriculars / activities — normalized to canonical vocabulary */
  activities: string[];
}

export interface SearchIntent {
  tones: string[];
  themes: string[];
  /** Raw university name as mentioned by user */
  target_uni: string | null;
  /** Resolved canonical slug (e.g. "upenn" for "penn") */
  target_uni_slug: string | null;
  semantic_keywords: string;
  major: string | null;
  /** Admission years mentioned (e.g. class of 2027 → 2027) */
  target_years: number[];
  ivy_league: boolean;
  activities: string[];
  /** US state abbreviation (e.g. "CA", "NY") */
  state: string | null;
  /** Region: northeast | south | midwest | west | mid_atlantic */
  region: string | null;
  /** School type: ivy | public_flagship | private_research | liberal_arts */
  university_type: string | null;
}

// ─── buildVibeSearchText ──────────────────────────────────────────────────────

/**
 * Flatten AI metadata into a single searchable string.
 * Both underscore and space forms are included so FTS and ILIKE both work.
 */
export function buildVibeSearchText(meta: EssayVibeMetadata): string {
  const expand = (s: string) => {
    const spaced = s.replace(/_/g, " ");
    return s === spaced ? s : `${s} ${spaced}`;
  };

  return [
    meta.major ?? "",
    ...(meta.activities ?? []).map(expand),
    meta.tone,
    ...(meta.themes ?? []).map(expand),
    ...(meta.core_values ?? []).map(expand),
    typeof meta.narrative_arc === "string" ? meta.narrative_arc.replace(/_/g, " ") : "",
    meta.vibe_summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ─── tagApplicationEssays ────────────────────────────────────────────────────

export async function tagApplicationEssays(
  essayText: string
): Promise<EssayVibeMetadata | null> {
  if (!isModelAvailable(DEFAULT_VIBE_MODEL)) return null;

  const prompt = `You are an expert college admissions analyst. Read the applicant's essay text (Common App and/or supplements combined).

Return ONLY a JSON object with these exact fields:

  "tone"           – single dominant tone: witty | vulnerable | analytical | earnest | urgent | reflective | determined | hopeful
  "core_values"    – array of 2–4 character traits (e.g. ["resilience", "intellectual_curiosity", "empathy"])
  "narrative_arc"  – one of: hero's_journey | internal_realization | slice_of_life | problem_solution | before_after
  "vibe_summary"   – one punchy sentence ≤20 words capturing the essay's heart for a search card
  "themes"         – array of 3–6 specific topic tags that characterize this essay (e.g. ["robotics", "identity", "first_gen", "STEM", "leadership"])
  "major"          – string: best inferred intended college major, or null if not inferable
  "activities"     – array: extracurriculars/identities the applicant mentions, normalized to the vocabulary below

ACTIVITY VOCABULARY — normalize extracted activities to these exact tokens only:
${ACTIVITY_VOCABULARY}

Examples:
  "I was captain of the debate team" → ["debate"]
  "competitive robotics and Model UN" → ["robotics", "model_un"]
  "played violin in the school orchestra" → ["music", "orchestra"]
  "first-generation college student from Mexico" → ["first_gen", "immigrant"]

Output ONLY valid JSON. No markdown, no explanation.

ESSAY TEXT:
${essayText.slice(0, 12000)}`;

  try {
    const data = await chatJson<EssayVibeMetadata>({
      model: DEFAULT_VIBE_MODEL,
      maxTokens: 800,
      prompt,
    });
    if (!data || !data.tone || !data.vibe_summary) return null;
    if (!Array.isArray(data.themes)) data.themes = [];
    if (!Array.isArray(data.core_values)) data.core_values = [];
    if (!Array.isArray(data.activities)) data.activities = [];
    if (data.major !== null && typeof data.major !== "string") data.major = null;
    return data;
  } catch (err) {
    console.error("tagApplicationEssays error:", err);
    return null;
  }
}

// ─── getEssayHighlight ────────────────────────────────────────────────────────

export async function getEssayHighlight(essayText: string): Promise<string | null> {
  if (!isModelAvailable(DEFAULT_FAST_MODEL)) return null;
  try {
    const text = await chatText({
      model: DEFAULT_FAST_MODEL,
      maxTokens: 120,
      prompt: `Extract the single most compelling sentence from this college application essay text. Return only that sentence, no quotes.\n\n${essayText.slice(0, 3000)}`,
    });
    return text?.trim().replace(/^["']|["']$/g, "") ?? null;
  } catch {
    return null;
  }
}

// ─── parseVibeSearchQuery ─────────────────────────────────────────────────────

export async function parseVibeSearchQuery(
  query: string
): Promise<SearchIntent | null> {
  if (!isModelAvailable(DEFAULT_FAST_MODEL)) return null;

  const aliasSnippet = buildAliasPromptSnippet();

  const prompt = `You classify search queries for a college application marketplace.

Convert the query into JSON with these exact fields:
  "tones"             – array of tone words (witty, vulnerable, analytical, earnest, reflective, determined, hopeful). Empty if none.
  "themes"            – specific topic tags from the query (robotics, debate, first_gen, STEM, immigration, leadership). Be generous.
  "target_uni"        – exact university name/nickname as typed (e.g. "Penn", "Cal", "Notre Dame"), else null
  "target_uni_slug"   – canonical slug for target_uni using the alias map below, else null
  "semantic_keywords" – 3–8 word phrase capturing the essay vibe for text matching
  "major"             – intended major if mentioned (e.g. "computer science", "pre-med"), else null
  "target_years"      – array of admission years as integers if mentioned (e.g. [2024]), else []
  "ivy_league"        – true if user clearly wants Ivy League (ivy, ivies, ivy league), else false
  "activities"        – clubs/sports/activities mentioned (debate, robotics, model_un, music), else []
  "state"             – 2-letter US state abbreviation if a specific state is mentioned (CA, NY, MA), else null
  "region"            – one of [northeast, south, midwest, west, mid_atlantic] if a region is mentioned, else null
  "university_type"   – one of [ivy, public_flagship, private_research, liberal_arts] if a school type is mentioned, else null

University alias map (nickname → canonical slug):
${aliasSnippet}

Additional alias hints:
  penn/upenn/wharton → upenn
  cal/berkeley/ucb → uc-berkeley
  carnegie mellon/cmu → cmu
  vandy → vanderbilt
  nd/notre dame → notre-dame
  jhu/johns hopkins/hopkins → jhu
  washu/wustl/wash u → washu
  bc/boston college → boston-college
  umich/michigan/u-m → umich
  uva/virginia → uva
  unc/carolina/chapel hill → unc
  usc/southern cal → usc
  gtown/hoyas → georgetown

State/region hints:
  "New England schools" → region: "northeast"
  "West Coast schools" → region: "west"
  "Southern schools" → region: "south"
  "California schools" → state: "CA"
  "New York schools" → state: "NY"
  "public schools" / "state schools" → university_type: "public_flagship"
  "liberal arts" → university_type: "liberal_arts"

Output ONLY JSON. No explanation.

Query: "${query.replace(/"/g, '\\"')}"`;

  try {
    const data = await chatJson<SearchIntent>({
      model: DEFAULT_FAST_MODEL,
      maxTokens: 600,
      prompt,
    });
    if (!data) return null;
    if (!Array.isArray(data.tones)) data.tones = [];
    if (!Array.isArray(data.themes)) data.themes = [];
    if (!Array.isArray(data.target_years)) data.target_years = [];
    if (!Array.isArray(data.activities)) data.activities = [];
    data.semantic_keywords = data.semantic_keywords?.trim() || query;
    data.ivy_league = Boolean(data.ivy_league);
    if (data.major && typeof data.major !== "string") data.major = null;
    if (!data.target_uni_slug || typeof data.target_uni_slug !== "string") data.target_uni_slug = null;
    if (!data.state || typeof data.state !== "string") data.state = null;
    if (!data.region || typeof data.region !== "string") data.region = null;
    if (!data.university_type || typeof data.university_type !== "string") data.university_type = null;
    return data;
  } catch (err) {
    console.error("parseVibeSearchQuery error:", err);
    return null;
  }
}

// ─── generateInsightBrief ────────────────────────────────────────────────────

/** Shape of the purchase-preview brief. Overwrites the old 5-field schema. */
export interface InsightBrief {
  common_app: {
    summary: string;
    topics: string[];
  };
  supplementals: Array<{
    prompt_summary: string;
    content_summary: string;
    word_count: number;
  }>;
  num_supplementals: number;
  what_youll_learn: string[];
  generated_at: string;
}

export interface InsightInput {
  commonAppContent: string | null;
  commonAppPrompt: string | null;
  submittedCommonApp: boolean;
  supplementals: Array<{ prompt?: string; content?: string }>;
  major: string | null;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generate a purchase-preview brief for an application. The brief is shown
 * to unpurchased viewers to help them decide whether to buy — no spoiler
 * sentences, just shape-of-what-you-get signals. Returns null on failure;
 * callers should treat null as "no brief yet" and hide the panel.
 */
export async function generateInsightBrief(
  input: InsightInput
): Promise<InsightBrief | null> {
  if (!isModelAvailable(DEFAULT_VIBE_MODEL)) return null;

  const commonAppBlock = input.submittedCommonApp && input.commonAppContent
    ? `COMMON APP PROMPT: ${input.commonAppPrompt ?? "(no prompt recorded)"}\n\nCOMMON APP ESSAY (${wordCount(input.commonAppContent)} words):\n${input.commonAppContent.slice(0, 8000)}`
    : "COMMON APP: not included in this listing.";

  const suppBlocks = input.supplementals
    .map((s, i) => {
      const content = (s.content ?? "").slice(0, 4000);
      return `SUPPLEMENTAL ${i + 1}\n  Prompt: ${s.prompt ?? "(no prompt recorded)"}\n  Word count: ${wordCount(s.content ?? "")}\n  Content: ${content}`;
    })
    .join("\n\n");

  const prompt = `You write purchase-preview briefs for a college application marketplace. Buyers see this BEFORE they pay — it must help them decide whether this application is worth buying WITHOUT giving away the essay's best lines or plot resolution.

Strict rules:
- No direct quotes from any essay.
- No spoiler sentences (no revealing the climactic realization or final line).
- Describe the SHAPE of the essay (what it's about, what structure it uses) not the content verbatim.
- Buyer-focused — what will they learn from reading this? Think "skim-before-checkout".

Return ONLY a JSON object with these exact fields:

  "common_app": {
     "summary": "40–60 word paraphrase of what the Common App essay is about — arc + topic, no quotes, no spoilers. Empty string '' if no Common App submitted.",
     "topics": ["3-6 short tag words — e.g. 'identity', 'leadership', 'robotics', 'first_gen'"]
  }
  "supplementals": [
     {
       "prompt_summary":  "≤10-word paraphrase of the supplemental's prompt (e.g. 'Why UPenn?', 'A community you belong to')",
       "content_summary": "15–30 words on what the applicant actually wrote about — no quotes",
       "word_count":      <integer word count of the content>
     }
     // one entry per supplemental, in order
  ]
  "num_supplementals": <integer — count of supplementals>
  "what_youll_learn": ["1–3 bullets of concrete takeaways a buyer will get from studying this application. Phrase as 'How to …' or 'A structure for …'. Skip generic praise."]

Output ONLY valid JSON. No markdown, no explanation.

APPLICANT MAJOR: ${input.major ?? "not specified"}
NUM SUPPLEMENTALS: ${input.supplementals.length}

${commonAppBlock}

${suppBlocks || "NO SUPPLEMENTALS"}`;

  try {
    const data = await chatJson<InsightBrief>({
      model: DEFAULT_VIBE_MODEL,
      maxTokens: 1200,
      prompt,
    });
    if (!data) return null;

    // Light validation — if the required shape is off, bail so callers can
    // fall back to "no brief" rather than persisting garbage.
    if (!data.common_app || typeof data.common_app.summary !== "string") return null;
    if (!Array.isArray(data.common_app.topics)) data.common_app.topics = [];
    if (!Array.isArray(data.supplementals)) data.supplementals = [];
    if (!Array.isArray(data.what_youll_learn)) data.what_youll_learn = [];
    data.num_supplementals = typeof data.num_supplementals === "number"
      ? data.num_supplementals
      : input.supplementals.length;
    data.generated_at = new Date().toISOString();
    return data;
  } catch (err) {
    console.error("generateInsightBrief error:", err);
    return null;
  }
}

// ─── rankApplicationsByRelevance ─────────────────────────────────────────────

type RankCandidate = {
  id: string;
  title: string;
  vibeSearchText: string | null;
  major: string | null;
  universityName: string;
  admittedYear: number | null;
};

/**
 * Returns application ids sorted by relevance (best first).
 * On failure, returns original order.
 */
export async function rankApplicationsByRelevance(
  userQuery: string,
  candidates: RankCandidate[]
): Promise<string[]> {
  if (!isModelAvailable(DEFAULT_FAST_MODEL) || candidates.length === 0) {
    return candidates.map((c) => c.id);
  }

  const lines = candidates.map((c, i) => {
    const vibe = (c.vibeSearchText ?? "").slice(0, 400);
    return `${i + 1}. id=${c.id} | uni=${c.universityName} | year=${c.admittedYear ?? "?"} | major=${c.major ?? "?"} | ${c.title.slice(0, 80)} | ${vibe}`;
  });

  const prompt = `You rank college application listings by relevance to the user's search.

User query: "${userQuery.replace(/"/g, '\\"')}"

Listings (one per line):
${lines.join("\n")}

Return ONLY a JSON array of objects {"id":"<uuid>","score":<0-100>} for every listing id above, sorted by score descending (most relevant first). Use the exact id values from the lines.`;

  try {
    const arr = await chatJson<{ id: string; score: number }[]>({
      model: DEFAULT_FAST_MODEL,
      maxTokens: 4000,
      prompt,
    });
    if (!Array.isArray(arr)) return candidates.map((c) => c.id);
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of arr) {
      if (row?.id && !seen.has(row.id)) {
        seen.add(row.id);
        ordered.push(row.id);
      }
    }
    for (const c of candidates) {
      if (!seen.has(c.id)) ordered.push(c.id);
    }
    return ordered;
  } catch (err) {
    console.error("rankApplicationsByRelevance error:", err);
    return candidates.map((c) => c.id);
  }
}
