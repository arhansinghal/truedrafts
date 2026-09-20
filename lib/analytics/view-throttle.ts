/**
 * In-memory per-IP throttle for view beacons.
 *
 * Lifted out of `app/api/essays/[id]/view/route.ts` so the new application view
 * beacon can share exactly the same policy instead of growing a second copy
 * that drifts.
 *
 * This is deliberately process-local. Serverless instances each keep their own
 * map, so the real-world window is "at most one view per IP per listing per 30
 * minutes per warm instance" — good enough to stop a refresh loop inflating a
 * writer's numbers, and not worth a Redis round-trip on a page-view path.
 */

const WINDOW_MS = 30 * 60 * 1000;

/** Above this many entries we sweep expired keys on the next write. */
const SWEEP_THRESHOLD = 10_000;

const seen = new Map<string, number>();

function sweep(now: number): void {
  const cutoff = now - WINDOW_MS;
  for (const [key, at] of seen.entries()) {
    if (at < cutoff) seen.delete(key);
  }
}

/** Best-effort client identity for throttling. Never persisted. */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  // `x-forwarded-for` is a comma-separated chain; the left-most entry is the
  // original client. Everything after it was added by proxies we control.
  const first = forwarded?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Returns true when this (client, listing) pair should be counted, and marks it
 * as counted. Returns false when it is still inside the throttle window.
 */
export function shouldCountView(
  req: Request,
  listingId: string,
  now: number = Date.now(),
): boolean {
  const key = `${clientKey(req)}:${listingId}`;
  const last = seen.get(key) ?? 0;
  if (now - last < WINDOW_MS) return false;

  seen.set(key, now);
  if (seen.size > SWEEP_THRESHOLD) sweep(now);
  return true;
}

/** Test hook — drops all throttle state. */
export function resetViewThrottle(): void {
  seen.clear();
}
