// Weekly cron — re-fetch URL sources older than REFRESH_DAYS.
// Skips PDFs (they don't change) and skips re-embedding when contentHash
// matches (idempotent on stable pages).
//
// Vercel Cron Jobs invoke this on a schedule defined in vercel.json. We gate
// on CRON_SECRET so it can't be abused publicly.

import { db } from "@/lib/db";
import { studioSources } from "@/lib/db/schema";
import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { ingestUrlSource } from "@/lib/studio/ingest";
import { STUDIO_ENABLED } from "@/lib/studio/enabled";

export const runtime = "nodejs";
export const maxDuration = 60;

const REFRESH_DAYS = 7;
const MAX_PER_RUN = 25;

export async function GET(req: Request) {
  // Studio disabled — don't do any refetch work. Ack so Vercel marks it OK.
  if (!STUDIO_ENABLED) {
    return Response.json({ skipped: "studio_disabled" });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cutoff = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000);

  const due = await db
    .select({ id: studioSources.id, uri: studioSources.uri, lastFetchedAt: studioSources.lastFetchedAt })
    .from(studioSources)
    .where(
      and(
        eq(studioSources.kind, "url"),
        or(isNull(studioSources.lastFetchedAt), lt(studioSources.lastFetchedAt, cutoff)),
        sql`${studioSources.status} != 'ingesting'`,
      ),
    )
    .limit(MAX_PER_RUN);

  const results: Array<{ id: string; outcome: string }> = [];
  for (const row of due) {
    const source = await db.query.studioSources.findFirst({
      where: eq(studioSources.id, row.id),
    });
    if (!source) continue;
    try {
      const r = await ingestUrlSource(source);
      results.push({ id: row.id, outcome: r.reused ? "unchanged" : r.status });
    } catch (err) {
      results.push({ id: row.id, outcome: `error:${err instanceof Error ? err.message : "unknown"}` });
    }
  }

  return Response.json({ scanned: due.length, results });
}
