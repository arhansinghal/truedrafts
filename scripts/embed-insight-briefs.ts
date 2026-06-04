// Backfill embeddings for college_applications.insightBrief.
//
// Library retrieval (Studio) needs these vectors to find pattern-similar
// successful essays for a school. Idempotent — only embeds rows where the
// vector is NULL.
//
// Usage: npx tsx scripts/embed-insight-briefs.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../lib/db";
import { collegeApplications } from "../lib/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { embed, isEmbeddingsEnabled, toVectorLiteral } from "../lib/studio/embeddings";
import { sql } from "drizzle-orm";

function summarize(briefJson: string): string {
  try {
    const o = JSON.parse(briefJson) as Record<string, unknown>;
    const flat: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === "string" && v.trim()) flat.push(v.trim());
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(o);
    return flat.join(" ").slice(0, 4000);
  } catch {
    return briefJson.slice(0, 4000);
  }
}

async function main() {
  if (!isEmbeddingsEnabled()) {
    console.error("VOYAGE_API_KEY is not set. Aborting.");
    process.exit(1);
  }

  const todo = await db
    .select({ id: collegeApplications.id, brief: collegeApplications.insightBrief })
    .from(collegeApplications)
    .where(
      and(
        eq(collegeApplications.status, "approved"),
        isNull(collegeApplications.insightBriefEmbedding),
      ),
    );

  console.log(`embed-insight-briefs: ${todo.length} rows pending`);

  const BATCH = 16;
  // Voyage free tier is 3 RPM — sleep 25s between batches. Set VOYAGE_FAST=1
  // to skip the throttle if you have paid-tier limits.
  const THROTTLE_MS = process.env.VOYAGE_FAST ? 0 : 25_000;
  let done = 0;
  let failed = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH).filter((r) => r.brief && r.brief.length > 20);
    if (batch.length === 0) continue;
    const texts = batch.map((r) => summarize(r.brief as string));
    if (i > 0 && THROTTLE_MS) await sleep(THROTTLE_MS);
    let vectors: number[][] | null = null;
    try {
      vectors = await embed(texts, "document");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      if (msg.includes("429")) {
        console.warn(`  rate limited — sleeping 60s`);
        await sleep(60_000);
        try { vectors = await embed(texts, "document"); } catch { vectors = null; }
      } else {
        console.warn(`  batch ${i} error: ${msg}`);
      }
    }
    if (!vectors) {
      console.warn(`batch ${i} embedding failed`);
      failed += batch.length;
      continue;
    }
    await Promise.all(
      batch.map(async (row, j) => {
        const v = vectors[j];
        if (!v) return;
        const lit = toVectorLiteral(v);
        await db
          .update(collegeApplications)
          .set({ insightBriefEmbedding: sql`${lit}::vector` })
          .where(eq(collegeApplications.id, row.id));
        done++;
      }),
    );
    console.log(`  embedded ${done}/${todo.length}`);
  }

  console.log(`Done: ${done} embedded, ${failed} failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
