// Haiku 4.5 synthesizer. Takes a (sentence, retrieval bundle) and returns up to
// 3 grounded continuations, each bound to a citable source.
//
// Design constraints:
//   • Output must be valid JSON — no preamble, no trailing text. We use the
//     Anthropic SDK with a JSON-shaped prompt; if parsing fails, return [].
//   • Hub passages are quotable. Library passages are *style only* — never
//     quote, only emulate pattern. Web passages are quotable with citation.
//   • Each suggestion is one sentence, max ~45 words, intended to extend the
//     student's last sentence — not paraphrase it.
//   • Refuse to fabricate names/places not in the context. Better to return
//     fewer (or zero) suggestions than to hallucinate.

import Anthropic from "@anthropic-ai/sdk";
import type { RetrievalBundle, HubPassage, LibraryPassage, WebPassage } from "./retrieval";

const MODEL = process.env.STUDIO_SYNTH_MODEL ?? "claude-haiku-4-5-20251001";
const MAX_SUGGESTIONS = 3;
const MAX_PASSAGE_CHARS = 700;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

type SynthSuggestion = {
  text: string;
  reason: string;
  // The 1-based index into the role-tagged passage list shown to the model.
  // Lets us map citation back to a source in the bundle.
  citationIndex: number | null;
  citationKind: "hub" | "web" | null;
};

type SynthResult = {
  suggestions: SynthSuggestion[];
  raw?: string;
  error?: string;
};

export async function synthesize(opts: {
  sentence: string;
  prompt: string | null;
  essayContext: string;
  bundle: RetrievalBundle;
}): Promise<SynthResult> {
  const { sentence, prompt, essayContext, bundle } = opts;
  if (!process.env.ANTHROPIC_API_KEY) {
    return { suggestions: [], error: "missing_anthropic_key" };
  }

  const { messageBlock, citationMap } = buildContextBlock(bundle);
  if (!messageBlock) {
    return { suggestions: [], error: "no_context" };
  }

  const system = `You are a research-grounded writing coach inside a college-essay editor. The user just finished a sentence and wants a SINGLE-SENTENCE continuation that extends the thought with concrete, verifiable detail drawn from the retrieved passages.

Hard rules:
- Output STRICT JSON: {"suggestions":[{"text":string,"reason":string,"citation":number|null}]}
- Up to ${MAX_SUGGESTIONS} suggestions. Fewer is fine. Return [] if nothing in the passages can ground a useful continuation.
- Each "text" is ONE sentence, max ~45 words, written in the student's first-person voice.
- Each "text" EXTENDS the last sentence — do not restate it, do not summarize what they said.
- Use a "citation" only when the suggestion's specific facts come from a [HUB] or [WEB] passage. Library passages are STYLE EXAMPLES ONLY — emulate cadence, never quote, never cite.
- "citation" is the 1-based index of the passage you used, or null if none (only allowed for [LIBRARY]-emulated stylistic continuations).
- Do not invent names, programs, professors, places, or dates. If the passages do not contain them, omit the suggestion.
- "reason" is one short clause (≤12 words) explaining why this continuation fits.`;

  const userPrompt = `Essay prompt: ${prompt?.slice(0, 400) || "(none provided)"}

Recent essay context (last ~600 chars):
"""
${essayContext.slice(-600)}
"""

The sentence the student just finished:
"${sentence}"

Retrieved passages:
${messageBlock}

Return JSON now.`;

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.4,
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();

    const parsed = safeParse(text);
    if (!parsed) return { suggestions: [], raw: text, error: "parse_failed" };

    const suggestions: SynthSuggestion[] = [];
    for (const s of parsed.suggestions.slice(0, MAX_SUGGESTIONS)) {
      const t = (s.text ?? "").toString().trim();
      if (!t) continue;
      const idx = typeof s.citation === "number" ? s.citation : null;
      const cite = idx !== null ? citationMap.get(idx) ?? null : null;
      suggestions.push({
        text: t,
        reason: (s.reason ?? "").toString().slice(0, 200),
        citationIndex: idx,
        citationKind: cite,
      });
    }
    return { suggestions, raw: text };
  } catch (err) {
    return { suggestions: [], error: err instanceof Error ? err.message : "unknown" };
  }
}

// Builds a numbered, role-tagged passage block. Returns the rendered block plus
// a 1-based-index → role map so the synthesizer's citation index can be mapped
// back to a source in the bundle.
function buildContextBlock(bundle: RetrievalBundle): {
  messageBlock: string;
  citationMap: Map<number, "hub" | "web">;
} {
  const lines: string[] = [];
  const citationMap = new Map<number, "hub" | "web">();
  let n = 0;

  for (const p of bundle.hub) {
    n++;
    citationMap.set(n, "hub");
    lines.push(`[${n}] [HUB] (${truncate(p.source.title, 60)})\n${truncate(p.text, MAX_PASSAGE_CHARS)}`);
  }
  for (const p of bundle.web) {
    n++;
    citationMap.set(n, "web");
    lines.push(`[${n}] [WEB] (${truncate(p.source.title, 60)})\n${truncate(p.text, MAX_PASSAGE_CHARS)}`);
  }
  // Library last + uncited so the model treats it as inspiration only.
  let libN = 0;
  for (const p of bundle.library.slice(0, 3)) {
    libN++;
    lines.push(`[L${libN}] [LIBRARY — STYLE ONLY, DO NOT QUOTE OR CITE] (${truncate(p.source.applicationTitle, 60)})\n${truncate(p.text, MAX_PASSAGE_CHARS)}`);
  }
  return { messageBlock: lines.join("\n\n"), citationMap };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function safeParse(text: string): { suggestions: Array<{ text?: unknown; reason?: unknown; citation?: unknown }> } | null {
  // Strip Markdown fences if the model added them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  // Find first { and last } to be lenient with stray prose.
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    const obj = JSON.parse(cleaned.slice(first, last + 1));
    if (!obj || typeof obj !== "object") return null;
    const sug = (obj as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(sug)) return null;
    return { suggestions: sug as Array<{ text?: unknown; reason?: unknown; citation?: unknown }> };
  } catch {
    return null;
  }
}

