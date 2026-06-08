// PDF-import — AI extraction pipeline.
//
// Primary path sends the PDFs to Claude natively as document blocks (preserves
// the activities-table layout that unpdf flattens, and handles scanned pages).
// If the document call hard-fails we fall back to unpdf text extraction + the
// same prompt as plain text.

import Anthropic from "@anthropic-ai/sdk";
import { extractFromPdf } from "@/lib/studio/extract";
import { COMMON_APP_PROMPTS } from "@/lib/common-app";
import type {
  ExtractionResult,
  ExtractedActivity,
  ExtractedSupplemental,
} from "./schema";

const MODEL = process.env.PDF_EXTRACT_MODEL ?? "claude-haiku-4-5-20251001";
// Verbatim essay + supplementals + activities ≈ 3–6k output tokens. A small
// cap silently truncates the JSON and the parse returns null — keep it high.
const MAX_TOKENS = 8192;

const SYSTEM = `You extract structured college-application data from the text of Common App PDF exports and related application documents. Return ONLY valid JSON matching the requested schema — no prose, no markdown fences. Copy essay and supplemental answer text VERBATIM from the source — never summarize, paraphrase, or fix typos. If a field is unknown, use an empty string, empty array, false, or -1 as appropriate.`;

export class ExtractionError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
  }
}

export type PdfInput = { filename: string; buffer: ArrayBuffer };

export async function extractApplication(files: PdfInput[]): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionError("ANTHROPIC_API_KEY is not configured.", 503);
  }

  let raw: string | null;
  try {
    raw = await callWithDocuments(files);
  } catch {
    // Native document path failed (model/API rejection) — fall back to unpdf.
    raw = await callWithExtractedText(files);
  }

  const parsed = extractJson<Partial<ExtractionResult>>(raw ?? "");
  if (!parsed) {
    throw new ExtractionError(
      "AI returned no parseable result (possible truncation — try a single PDF, or set PDF_EXTRACT_MODEL to a Sonnet model).",
    );
  }
  return normalize(parsed);
}

// Resolve an extracted university name to a known university id (name + aliases).
// Returns "" when there's no confident match — the wizard's step 1 then asks the
// writer to pick. Server-side so the endpoint can map before seeding the draft.
export function matchUniversity(
  name: string,
  unis: { id: string; name: string; aliases: string[] | null }[],
): string {
  const q = name.trim().toLowerCase();
  if (!q) return "";
  for (const u of unis) {
    const n = u.name.toLowerCase();
    if (n === q || n.includes(q) || q.includes(n)) return u.id;
  }
  for (const u of unis) {
    if ((u.aliases ?? []).some((a) => a.toLowerCase() === q || q.includes(a.toLowerCase()))) {
      return u.id;
    }
  }
  return "";
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function instructionText(): string {
  const promptList = COMMON_APP_PROMPTS.map((p, i) => `${i}. ${p}`).join("\n");
  return `Extract the application data from the attached document(s). One document is typically the official Common App PDF export; a second (if present) may contain university-specific supplemental essays.

The 7 official Common App personal-statement prompts, numbered 0-6:
${promptList}

Return a single JSON object with EXACTLY these keys:
{
  "universityName": string,        // the university this application was submitted to ("" if unclear)
  "admittedYear": string,          // 4-digit admission/entry year, e.g. "2024" ("" if unclear)
  "submittedCommonApp": boolean,   // true if a Common App personal statement is present
  "caPromptIndex": number,         // 0-6 = best-matching official prompt above, -1 if none/unknown
  "caContent": string,             // the FULL personal statement, VERBATIM
  "supplementals": [{"prompt": string, "content": string}],  // each supplemental/university-specific essay
  "activities": [{"position": string, "organization": string, "description": string}],
  "honorsAwards": string[],
  "intendedMajor": string,
  "notes": string                  // anything else useful + extraction caveats
}

Rules:
- Essay and answer text must be VERBATIM — exact words, punctuation, and paragraph breaks from the source.
- One activities entry per activity in the Common App activities section: position/role, organization, and a short description.
- The personal statement (Common App essay) goes ONLY in caContent, never in supplementals.
- supplementals = university-specific essays/short answers with their full prompts.`;
}

// ─── Call paths ───────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

async function callWithDocuments(files: PdfInput[]): Promise<string | null> {
  const content: Anthropic.ContentBlockParam[] = [];
  for (const f of files) {
    content.push({ type: "text", text: `Document: ${f.filename}` });
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: Buffer.from(f.buffer).toString("base64"),
      },
    });
  }
  content.push({ type: "text", text: instructionText() });

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  const block = msg.content[0];
  return block?.type === "text" ? block.text : null;
}

async function callWithExtractedText(files: PdfInput[]): Promise<string | null> {
  const parts: string[] = [];
  for (const f of files) {
    const { text } = await extractFromPdf(f.buffer);
    parts.push(`=== FILE: ${f.filename} ===\n${text}`);
  }
  const combined = parts.join("\n\n");
  if (combined.replace(/\s/g, "").length < 500) {
    throw new ExtractionError(
      "The PDF has no extractable text (likely scanned/image-only) and the document-vision path failed.",
      422,
    );
  }

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    system: SYSTEM,
    messages: [{ role: "user", content: `${instructionText()}\n\n${combined}` }],
  });
  const block = msg.content[0];
  return block?.type === "text" ? block.text : null;
}

// ─── Parsing & normalization ──────────────────────────────────────────────────

function extractJson<T>(text: string): T | null {
  const stripped = text.trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalize(p: Partial<ExtractionResult>): ExtractionResult {
  const caPromptIndex =
    typeof p.caPromptIndex === "number" && p.caPromptIndex >= 0 && p.caPromptIndex <= 6
      ? Math.floor(p.caPromptIndex)
      : -1;

  const supplementals: ExtractedSupplemental[] = Array.isArray(p.supplementals)
    ? p.supplementals.map((s) => ({ prompt: str(s?.prompt), content: str(s?.content) }))
    : [];

  const activities: ExtractedActivity[] = Array.isArray(p.activities)
    ? p.activities.map((a) => ({
        position: str(a?.position),
        organization: str(a?.organization),
        description: str(a?.description),
      }))
    : [];

  return {
    universityName: str(p.universityName),
    admittedYear: /^\d{4}$/.test(str(p.admittedYear)) ? str(p.admittedYear) : "",
    submittedCommonApp: p.submittedCommonApp === true || str(p.caContent).trim().length > 0,
    caPromptIndex,
    caContent: str(p.caContent),
    supplementals,
    activities,
    honorsAwards: Array.isArray(p.honorsAwards) ? p.honorsAwards.map(str).filter(Boolean) : [],
    intendedMajor: str(p.intendedMajor),
    notes: str(p.notes),
  };
}
