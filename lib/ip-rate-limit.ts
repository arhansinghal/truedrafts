// Lightweight in-memory fixed-window rate limiter for PUBLIC, cost-bearing
// endpoints (e.g. an LLM call reachable without auth).
//
// SCOPE / LIMITS: this is per-process. On serverless (Vercel) each warm
// instance keeps its own counters, so it caps a single attacker's throughput
// per instance rather than globally. That is enough to turn "unbounded free
// LLM spend" into a bounded, self-throttling cost — but for hard, cross-instance
// guarantees back this with a shared store (Redis/Upstash) in production.

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();
const MAX_KEYS = 10_000; // memory backstop against unique-key floods

/** Returns true if the call is allowed, false if the key is over its limit. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const w = store.get(key);

  if (!w || now >= w.resetAt) {
    if (store.size > MAX_KEYS) prune(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= max) return false;
  w.count++;
  return true;
}

/** Drop expired windows; if still over budget, clear the lot (fail-open). */
function prune(now: number) {
  for (const [k, w] of store) if (now >= w.resetAt) store.delete(k);
  if (store.size > MAX_KEYS) store.clear();
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
