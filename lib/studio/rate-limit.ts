// Persisted token-bucket rate limiter backed by studio_rate_limits.
//
// Buckets we use:
//   suggest_min  — 12 / minute   (sentence-end is bursty — covers steady typing)
//   suggest_day  — 400 / day     (caps abuse without throttling real essays)
//
// All windows are "rolling fixed" — start time = floor(now / windowSec) so
// rows naturally rotate. We upsert (userId, bucket, windowStart) and increment
// count on hit. Cheaper than a true sliding window; good enough at this scale.

import { db } from "@/lib/db";
import { studioRateLimits } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

type Bucket = "suggest_min" | "suggest_day";

const LIMITS: Record<Bucket, { max: number; windowSec: number }> = {
  suggest_min: { max: 12, windowSec: 60 },
  suggest_day: { max: 400, windowSec: 60 * 60 * 24 },
};

type RateLimitOk = { ok: true; bucket: Bucket; remaining: number };
type RateLimitDeny = { ok: false; bucket: Bucket; retryAfterSec: number };

export async function checkAndIncrement(
  userId: string,
  buckets: Bucket[] = ["suggest_min", "suggest_day"],
): Promise<RateLimitOk | RateLimitDeny> {
  const now = Date.now();
  for (const bucket of buckets) {
    const cfg = LIMITS[bucket];
    const windowStart = new Date(Math.floor(now / (cfg.windowSec * 1000)) * cfg.windowSec * 1000);

    // Upsert+increment in one statement; returning lets us inspect the new count.
    const rows = await db
      .insert(studioRateLimits)
      .values({ userId, bucket, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [studioRateLimits.userId, studioRateLimits.bucket, studioRateLimits.windowStart],
        set: { count: sql`${studioRateLimits.count} + 1` },
      })
      .returning({ count: studioRateLimits.count });

    const count = rows[0]?.count ?? 1;
    if (count > cfg.max) {
      const retry = Math.max(1, Math.ceil((windowStart.getTime() + cfg.windowSec * 1000 - now) / 1000));
      return { ok: false, bucket, retryAfterSec: retry };
    }
  }
  return { ok: true, bucket: buckets[buckets.length - 1], remaining: 0 };
}
