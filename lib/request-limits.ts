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
