// Provider-agnostic LLM client. Routes by model id prefix so call sites can
// swap providers via env vars without importing different SDKs.
//
//   "claude-*"   → Anthropic SDK
//   "deepseek-*" → DeepSeek (OpenAI-compatible REST, no SDK dep)
//
// Two surfaces:
//   chatJson  – returns the first JSON object/array found in the response
//   chatText  – returns plain text (used for the essay-highlight one-liner)

import Anthropic from "@anthropic-ai/sdk";

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export type ChatOpts = {
  model: string;
  prompt: string;
  maxTokens: number;
  system?: string;
  temperature?: number;
};

function isDeepSeek(model: string): boolean {
  return model.startsWith("deepseek");
}

function isClaude(model: string): boolean {
  return model.startsWith("claude");
}

export function isModelAvailable(model: string): boolean {
  if (isClaude(model)) return !!process.env.ANTHROPIC_API_KEY;
  if (isDeepSeek(model)) return !!process.env.DEEPSEEK_API_KEY;
  return false;
}

export async function chatText(opts: ChatOpts): Promise<string | null> {
  const { model } = opts;
  if (isClaude(model)) return claudeText(opts);
  if (isDeepSeek(model)) return deepseekText(opts);
  throw new Error(`Unknown model provider: ${model}`);
}

export async function chatJson<T = unknown>(opts: ChatOpts): Promise<T | null> {
  const raw = await chatText(opts);
  if (!raw) return null;
  return extractJson<T>(raw);
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function claudeText(opts: ChatOpts): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const msg = await anthropicClient.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    temperature: opts.temperature,
    messages: [{ role: "user", content: opts.prompt }],
  });
  const block = msg.content[0];
  return block?.type === "text" ? block.text : null;
}

// ─── DeepSeek (OpenAI-compatible) ─────────────────────────────────────────────

type DeepSeekResponse = {
  choices: { message: { content: string | null } }[];
};

async function deepseekText(opts: ChatOpts): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const messages: { role: "system" | "user"; content: string }[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    max_tokens: opts.maxTokens,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as DeepSeekResponse;
  return json.choices?.[0]?.message?.content ?? null;
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJson<T>(text: string): T | null {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // DeepSeek's json_object mode returns a bare JSON object. For Claude we may
  // get prose around it, so fall back to first-{...}-or-[...] match.
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
