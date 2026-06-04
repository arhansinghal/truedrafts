// Ingestion orchestrator: extract → chunk → embed → insert.
//
// Idempotent on contentHash: if extracted text matches the existing hash for a
// source, we skip re-embedding and just bump lastFetchedAt. Used by the weekly
// cron to avoid pointless re-embed when source content hasn't changed.

import { db } from "@/lib/db";
import {
  studioSources,
  studioSourceChunks,
  type StudioSource,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractFromPdf, extractFromUrl, sha256HexAsync } from "./extract";
import { chunkText } from "./chunk";
import { embed, isEmbeddingsEnabled } from "./embeddings";

const MAX_CHUNKS_PER_SOURCE = 50;

export type IngestResult = {
  status: "ready" | "failed" | "paywalled";
  chunksInserted: number;
  reused: boolean;
  errorMessage?: string;
};

export async function ingestUrlSource(source: StudioSource): Promise<IngestResult> {
  await markIngesting(source.id);
  try {
    const ex = await extractFromUrl(source.uri);
    if (!ex.text) {
      return await markFailed(source.id, "Could not extract content from URL");
    }
    if (ex.paywalled) {
      return await finalize(source, ex.text, ex.title, "paywalled");
    }
    return await finalize(source, ex.text, ex.title, "ready");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return await markFailed(source.id, msg);
  }
}

export async function ingestPdfSource(
  source: StudioSource,
  buffer: ArrayBuffer,
): Promise<IngestResult> {
  await markIngesting(source.id);
  try {
    const ex = await extractFromPdf(buffer);
    if (!ex.text) {
      return await markFailed(source.id, "PDF contained no extractable text");
    }
    return await finalize(source, ex.text, ex.title, "ready");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "PDF parse error";
    return await markFailed(source.id, msg);
  }
}

async function markIngesting(id: string) {
  await db
    .update(studioSources)
    .set({ status: "ingesting", errorMessage: null })
    .where(eq(studioSources.id, id));
}

async function markFailed(id: string, message: string): Promise<IngestResult> {
  await db
    .update(studioSources)
    .set({ status: "failed", errorMessage: message, lastFetchedAt: new Date() })
    .where(eq(studioSources.id, id));
  return { status: "failed", chunksInserted: 0, reused: false, errorMessage: message };
}

async function finalize(
  source: StudioSource,
  text: string,
  title: string,
  status: "ready" | "paywalled",
): Promise<IngestResult> {
  const hash = await sha256HexAsync(text);

  // Reuse existing chunks if hash matches. This is what makes the weekly
  // cron cheap.
  if (source.contentHash === hash) {
    await db
      .update(studioSources)
      .set({ status, lastFetchedAt: new Date(), title })
      .where(eq(studioSources.id, source.id));
    return { status, chunksInserted: 0, reused: true };
  }

  // Otherwise wipe + reinsert chunks.
  await db.delete(studioSourceChunks).where(eq(studioSourceChunks.sourceId, source.id));

  const chunks = chunkText(text).slice(0, MAX_CHUNKS_PER_SOURCE);
  if (chunks.length === 0) {
    return await markFailed(source.id, "No chunks produced from extracted text");
  }

  let embeddings: number[][] | null = null;
  if (isEmbeddingsEnabled()) {
    try {
      embeddings = await embed(
        chunks.map((c) => c.text),
        "document",
      );
    } catch (e) {
      // Embedding failure is non-fatal — chunks still saved as text-only,
      // retrieval will fall back to ILIKE in this case.
      console.warn("[studio/ingest] embedding failed:", e);
    }
  }

  const rows = chunks.map((c, i) => ({
    sourceId: source.id,
    appId: source.appId,
    ord: c.ord,
    text: c.text,
    tokenCount: c.tokenCount,
    embedding: embeddings?.[i] ?? null,
  }));

  // Insert in batches of 50 to stay under any limits.
  for (let i = 0; i < rows.length; i += 50) {
    await db.insert(studioSourceChunks).values(rows.slice(i, i + 50));
  }

  await db
    .update(studioSources)
    .set({
      status,
      title,
      contentHash: hash,
      lastFetchedAt: new Date(),
      errorMessage: null,
    })
    .where(eq(studioSources.id, source.id));

  return { status, chunksInserted: rows.length, reused: false };
}
