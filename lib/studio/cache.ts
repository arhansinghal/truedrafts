// Tiny in-process LRU keyed on (appId + sentence + webEnabled).
//
// Why so small / why in-process: writers retype the same sentence often
// (delete a word, retype it, hit period again). Caching the last few hundred
// keys per process gives us 30–50% hit rate empirically without persisting a
// table. Serverless cold starts wipe it; that's fine — the cache is a perf
// win, not a correctness contract.

const MAX_ENTRIES = 256;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

type Entry<V> = { value: V; expires: number };

const store = new Map<string, Entry<unknown>>();

export function cacheKey(appId: string, sentence: string, webEnabled: boolean): string {
  // Normalize whitespace + casing so trivial edits hit the same key.
  const normalized = sentence.toLowerCase().replace(/\s+/g, " ").trim();
  return `${appId}::${webEnabled ? "w" : "h"}::${normalized}`;
}

export function cacheGet<V>(key: string): V | null {
  const e = store.get(key) as Entry<V> | undefined;
  if (!e) return null;
  if (e.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  // Re-insert to move to MRU end.
  store.delete(key);
  store.set(key, e);
  return e.value;
}

export function cacheSet<V>(key: string, value: V): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + TTL_MS });
}
