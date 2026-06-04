// Extracts clean text from URLs (HTML) and PDF buffers.
//
// URL strategy is tiered:
//   1. fetch + @mozilla/readability via jsdom — handles ~80% of static pages
//      (news, blogs, university pages, professor bios).
//   2. Jina Reader fallback (r.jina.ai/<url>) for JS-rendered SPAs. Free at
//      low volume, returns clean markdown.
//
// Paywall heuristic: if extracted text is suspiciously short or contains
// known wall markers, return paywalled status so the UI can flag it.

import { extractText, getDocumentProxy } from "unpdf";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
turndown.remove(["script", "style", "iframe", "noscript", "form", "button"]);

const PAYWALL_MARKERS = [
  /subscribe to (read|continue)/i,
  /sign in to (read|continue)/i,
  /create a free account to/i,
  /this article is for subscribers/i,
];

const MIN_BODY_CHARS = 200;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export type Extracted = {
  title: string;
  text: string;
  paywalled: boolean;
};

export async function extractFromPdf(buffer: ArrayBuffer): Promise<Extracted> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const flat = (Array.isArray(text) ? text.join("\n\n") : text).trim();
  // Use the first non-empty line as title fallback if no metadata title.
  const meta = await pdf.getMetadata().catch(() => null);
  const metaTitle =
    (meta?.info && typeof meta.info === "object" && "Title" in meta.info
      ? String((meta.info as { Title?: unknown }).Title ?? "")
      : "") || "";
  const firstLine = flat.split("\n").find((l) => l.trim().length > 4) ?? "Untitled PDF";
  return {
    title: metaTitle.trim() || firstLine.slice(0, 120).trim(),
    text: flat,
    paywalled: false,
  };
}

export async function extractFromUrl(url: string): Promise<Extracted> {
  // Tier 1 — direct fetch + readability.
  const direct = await tryDirect(url);
  if (direct && direct.text.length >= MIN_BODY_CHARS && !direct.paywalled) {
    return direct;
  }

  // Tier 2 — Jina Reader fallback for SPAs.
  const jina = await tryJina(url);
  if (jina) return jina;

  // If both produced something but short/paywalled, prefer the longer one and
  // mark paywalled.
  const best = [direct, null].filter(Boolean) as Extracted[];
  if (best.length === 0) {
    return { title: url, text: "", paywalled: false };
  }
  const top = best.sort((a, b) => b.text.length - a.text.length)[0];
  return { ...top, paywalled: top.paywalled || top.text.length < MIN_BODY_CHARS };
}

async function tryDirect(url: string): Promise<Extracted | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "TrueDrafts-Studio/1.0 (+https://truedrafts.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) break;
      chunks.push(value);
    }
    const html = new TextDecoder().decode(concatBytes(chunks));
    return readabilityExtract(html, url);
  } catch {
    return null;
  }
}

function readabilityExtract(html: string, url: string): Extracted | null {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.content) return null;
    const md = turndown.turndown(article.content).trim();
    const paywalled = PAYWALL_MARKERS.some((rx) => rx.test(md));
    return {
      title: article.title?.trim() || url,
      text: md,
      paywalled,
    };
  } catch {
    return null;
  }
}

async function tryJina(url: string): Promise<Extracted | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const reqUrl = `https://r.jina.ai/${url}`;
    const res = await fetch(reqUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "TrueDrafts-Studio/1.0",
        Accept: "text/markdown",
        // Jina honors X-No-Cache: false; we want cached when fast.
      },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text) return null;
    // Jina prepends "Title: ..." then "URL Source: ..." then a blank line.
    const titleMatch = text.match(/^Title:\s*(.*)$/m);
    const body = text.replace(/^Title:.*$/m, "").replace(/^URL Source:.*$/m, "").trim();
    const paywalled = PAYWALL_MARKERS.some((rx) => rx.test(body));
    return {
      title: (titleMatch?.[1] ?? url).trim(),
      text: body,
      paywalled,
    };
  } catch {
    return null;
  }
}

function concatBytes(arrs: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

export function sha256Hex(text: string): string {
  // Lightweight, no external dep — use crypto.subtle in Edge / Node 20+.
  // Fall back to a synchronous fnv-1a if subtle is unavailable.
  if (typeof crypto !== "undefined" && crypto.subtle) {
    // Caller wraps in await
    throw new Error("Use sha256HexAsync; sync version not available in this runtime");
  }
  return fnv1a(text);
}

export async function sha256HexAsync(text: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return fnv1a(text);
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
