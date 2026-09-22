// Server-side payload-size guards for routes that accept user-supplied blobs
// (base64 data-URI images persisted into DB text columns). The upload wizard
// caps size client-side, but the API parses raw JSON, so without these a writer
// could POST a multi-MB/GB blob straight to the route — bloating the DB and
// OOM-ing the admin review queue (which renders every pending proof inline).

// ~6 MB of binary as a base64 data-URI (base64 ≈ 1.37× the binary size).
export const MAX_IMAGE_CHARS = 8 * 1024 * 1024;
// Plain-text essay/long-text fields.
export const MAX_TEXT_CHARS = 200_000;
// Hard ceiling on a whole request body. Covers the wizard's draft `data` blob,
// which can carry two images plus the essays in one request.
export const MAX_BODY_BYTES = 25 * 1024 * 1024;

/** Fast reject via Content-Length before buffering the body (best-effort: the
 *  header can be absent on chunked requests, so always pair with field checks). */
export function bodyExceedsLimit(req: Request, max = MAX_BODY_BYTES): boolean {
  const len = Number(req.headers.get("content-length") ?? 0);
  return Number.isFinite(len) && len > max;
}

/** True when a string field is present and over its character budget. */
export function tooLong(v: unknown, max: number): boolean {
  return typeof v === "string" && v.length > max;
}

// ─── Streaming body guard ────────────────────────────────────────────────────
// bodyExceedsLimit above trusts Content-Length, which a chunked request can
// simply omit. These enforce the cap *while reading*, so the process never
// buffers more than `max` bytes no matter what the client claims.

/** Cap for small JSON form bodies (onboarding profile, writer settings, …).
 *  Generous next to a realistic payload — bio is capped at 300 chars in the UI
 *  and activities/honors are short {name, description} arrays — but small
 *  enough that an authenticated client can't make the server hold megabytes. */
const MAX_JSON_BODY_BYTES = 100_000;

/** Reads the body as text, refusing to buffer more than `max` bytes.
 *  Returns null when the body exceeds the cap (the stream is cancelled), or
 *  "" when there is no body at all. */
async function readBodyBounded(
  req: Request,
  max = MAX_JSON_BODY_BYTES,
): Promise<string | null> {
  // Cheap reject when the client sent an honest Content-Length.
  if (bodyExceedsLimit(req, max)) return null;

  const reader = req.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

type BoundedJson =
  | { ok: true; value: unknown }
  | { ok: false; status: 413 | 400; error: string };

/** Size-capped JSON parse. Callers get a ready-made status/error for the two
 *  failure modes so every route answers an oversized or malformed body the
 *  same way. */
export async function readJsonBounded(
  req: Request,
  max = MAX_JSON_BODY_BYTES,
): Promise<BoundedJson> {
  const raw = await readBodyBounded(req, max);
  if (raw === null) return { ok: false, status: 413, error: "Payload too large" };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, error: "Invalid JSON" };
  }
}
