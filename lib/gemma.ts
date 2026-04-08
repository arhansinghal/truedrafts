import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;
function getAI() {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  return _ai;
}

const TAGGER_MODEL = "gemma-4-31b-it";
const PARSER_MODEL = "gemma-4-26b-a4b-it";

export interface EssayVibeMetadata {
  tone: string;
  core_values: string[];
  narrative_arc: string;
  vibe_summary: string;
}

export interface SearchIntent {
  tones: string[];
  target_uni: string | null;
  semantic_keywords: string;
}

function extractJson(text: string): unknown {
  // Strip thinking blocks, then find first {...} or [...]
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error(`No JSON in response: ${stripped.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// ---------------------------------------------------------------------------
// Tagging engine — called once on essay approval
// ---------------------------------------------------------------------------
export async function tagEssay(essayText: string): Promise<EssayVibeMetadata | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const prompt = `You are an expert college admissions essay analyst.

Analyse the essay and return ONLY a JSON object with these exact fields:
  "tone"           – single dominant tone word (witty | vulnerable | analytical | earnest | urgent | reflective | determined | hopeful)
  "core_values"    – array of 2–4 character traits (e.g. ["resilience", "intellectual_curiosity"])
  "narrative_arc"  – one of: hero's_journey | internal_realization | slice_of_life | problem_solution | before_after
  "vibe_summary"   – one punchy sentence ≤20 words for a search result card

Output ONLY the JSON. No markdown, no explanation.

ESSAY:
${essayText}`;

  try {
    const result = await getAI().models.generateContent({
      model: TAGGER_MODEL,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 8192 },
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    });
    const data = extractJson(result.text ?? "") as EssayVibeMetadata;
    if (!data.tone || !data.vibe_summary) return null;
    return data;
  } catch (err) {
    console.error("Gemma tagging error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Search intent parser — called on every vibe search
// ---------------------------------------------------------------------------
export async function parseSearchQuery(query: string): Promise<SearchIntent | null> {
  if (!process.env.GEMINI_API_KEY) return null;

  const prompt = `You are a search intent classifier for a college essay marketplace.

Convert this search query into a JSON object with these exact fields:
  "tones"             – array of tone words. Map: funny→witty, sad→vulnerable, nerdy→analytical, inspiring→uplifting, confident→determined. Empty array if no tone.
  "target_uni"        – university name string if mentioned, otherwise null
  "semantic_keywords" – 3–6 word phrase capturing the core vibe for text search

Output ONLY the JSON. No markdown, no explanation.

Query: "${query}"`;

  try {
    const result = await getAI().models.generateContent({
      model: PARSER_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 128,
      },
    });
    const data = extractJson(result.text ?? "") as SearchIntent;
    if (!Array.isArray(data.tones)) data.tones = [];
    data.semantic_keywords = data.semantic_keywords ?? query;
    return data;
  } catch (err) {
    console.error("Gemma parse error:", err);
    return null;
  }
}
