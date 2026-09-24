// Minimal PDF → text extraction for the PDF-import route, using ONLY unpdf.
//
// This deliberately does NOT live in lib/studio/extract.ts: that module is the
// web-page scraper and imports jsdom + @mozilla/readability + turndown and
// instantiates a TurndownService at module load. Importing it pulls that whole
// graph (jsdom alone is ~600 traced files, externalized) into this route's
// serverless function. On Vercel that module-load surface was failing and the
// /api/writer/applications/extract route 500'd on every request — before auth
// even ran — while local dev/build worked (full node_modules present). Keeping
// the PDF path on a tiny unpdf-only module removes that fragile surface.

import { extractText, getDocumentProxy } from "unpdf";

// unpdf's bundled pdf.js (pdfjs-dist 5.x) calls `Promise.try`, which only exists
// on Node 22+. The Vercel runtime Node version isn't pinned in this repo, so
// guard the unpdf path against a Node 20 runtime with a spec-compliant polyfill
// (no-op where Promise.try already exists). Without this the fallback text path
// throws "Promise.try is not a function" on older runtimes.
const P = Promise as unknown as { try?: (fn: (...a: unknown[]) => unknown, ...a: unknown[]) => Promise<unknown> };
if (typeof P.try !== "function") {
  P.try = (fn, ...args) => new Promise((resolve) => resolve(fn(...args)));
}

type PdfText = { title: string; text: string };

export async function extractFromPdf(buffer: ArrayBuffer): Promise<PdfText> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const flat = (Array.isArray(text) ? text.join("\n\n") : text).trim();
  // Use PDF metadata title when present, else the first substantial line.
  const meta = await pdf.getMetadata().catch(() => null);
  const metaTitle =
    meta?.info && typeof meta.info === "object" && "Title" in meta.info
      ? String((meta.info as { Title?: unknown }).Title ?? "")
      : "";
  const firstLine = flat.split("\n").find((l) => l.trim().length > 4) ?? "Untitled PDF";
  return {
    title: metaTitle.trim() || firstLine.slice(0, 120).trim(),
    text: flat,
  };
}
