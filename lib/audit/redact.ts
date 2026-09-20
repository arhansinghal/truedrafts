/**
 * Redaction and diffing for the admin audit log.
 *
 * An audit log is only worth keeping if it is safe to keep. These records
 * outlive the rows they describe and are read by every admin, so anything
 * secret has to be stripped on the way in — not filtered on the way out, where
 * one forgetful query exposes it.
 *
 * Pure functions with no I/O, so what gets stored is fully testable.
 */

/** What replaces a redacted value. Deliberately not the empty string. */
export const REDACTED = "[redacted]";

/**
 * Key names whose values never enter the log.
 *
 * Matched case-insensitively against the key, anywhere in it, so
 * `bankAccountNumberEncrypted`, `account_number` and `ACCOUNTNUMBER` all hit.
 * Deliberately broad: a false positive costs a reader one field of context, a
 * false negative writes a secret to a table a dozen people can read.
 */
const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /pass(word|phrase)/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /signature/i,
  /encrypted/i,
  /account[-_]?number/i,
  // Plain substrings, not \b-anchored: these arrive camel-cased off the
  // schema (`bankIfsc`, `upiId`, `zelleEmail`) where there is no word boundary
  // before the term. Each string is distinctive enough not to false-positive.
  /ifsc/i,
  /upi/i,
  /zelle/i,
  /cvv/i,
  /aadhaar/i,
  // "pan" is three very common letters ("panel", "company", "expand"), so this
  // one does have to be anchored.
  /^pan$|pan[-_]?(number|card)/i,
];

/** Values longer than this are truncated; essays do not belong in an audit row. */
export const MAX_VALUE_LENGTH = 500;

/** How deep into nested objects redaction descends before giving up. */
const MAX_DEPTH = 6;

/** Most array entries kept. Beyond this the array is summarised. */
const MAX_ARRAY_LENGTH = 25;

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/** A JSON-safe value, after redaction. */
export type Redacted =
  | string
  | number
  | boolean
  | null
  | Redacted[]
  | { [key: string]: Redacted };

function truncate(value: string): string {
  if (value.length <= MAX_VALUE_LENGTH) return value;
  return `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} chars)`;
}

/**
 * Deep-copy a value, replacing anything sensitive and bounding anything large.
 *
 * Cycles are impossible in the plain rows we log, but the depth cap means a
 * surprise one degrades to `"[depth limit]"` rather than blowing the stack.
 */
export function redact(value: unknown, depth = 0): Redacted {
  if (value === null || value === undefined) return null;

  if (depth > MAX_DEPTH) return "[depth limit]";

  if (typeof value === "string") return truncate(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (Array.isArray(value)) {
    const kept = value
      .slice(0, MAX_ARRAY_LENGTH)
      .map((entry) => redact(entry, depth + 1));
    if (value.length > MAX_ARRAY_LENGTH) {
      kept.push(`… ${value.length - MAX_ARRAY_LENGTH} more`);
    }
    return kept;
  }

  if (typeof value === "object") {
    const out: Record<string, Redacted> = {};
    for (const [key, entry] of Object.entries(value as object)) {
      if (typeof entry === "function" || typeof entry === "symbol") continue;
      out[key] = isSensitiveKey(key) ? REDACTED : redact(entry, depth + 1);
    }
    return out;
  }

  // Functions, symbols and anything else exotic have no place in a record of
  // what changed.
  return null;
}

/** One field that moved. */
export type FieldChange = {
  /** Dotted path, e.g. `payoutMethodSnapshot.kind`. */
  path: string;
  before: Redacted;
  after: Redacted;
};

function isPlainObject(value: Redacted): value is { [key: string]: Redacted } {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/** Structural equality over already-redacted, JSON-safe values. */
export function sameValue(a: Redacted, b: Redacted): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((entry, i) => sameValue(entry, b[i]));
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!sameValue(a[key] ?? null, b[key] ?? null)) return false;
    }
    return true;
  }

  return false;
}

/**
 * The fields that differ between two already-redacted snapshots.
 *
 * Nested objects are walked so the log reads `snapshot.kind: bank → upi`
 * rather than dumping both objects whole. Arrays are compared as single values:
 * "these tags changed" is the useful statement, not an index-by-index diff.
 *
 * A key present on one side and absent on the other counts as a change, with
 * `null` standing in for the missing side.
 */
export function diffRedacted(
  before: Redacted,
  after: Redacted,
  prefix = "",
): FieldChange[] {
  if (isPlainObject(before) && isPlainObject(after)) {
    const changes: FieldChange[] = [];
    const keys = Array.from(
      new Set([...Object.keys(before), ...Object.keys(after)]),
    ).sort();

    for (const key of keys) {
      const path = prefix ? `${prefix}.${key}` : key;
      changes.push(
        ...diffRedacted(before[key] ?? null, after[key] ?? null, path),
      );
    }
    return changes;
  }

  if (sameValue(before, after)) return [];
  return [{ path: prefix || "value", before, after }];
}

/** Redact both sides and diff them in one step. */
export function diff(before: unknown, after: unknown): FieldChange[] {
  return diffRedacted(redact(before), redact(after));
}

/** Render a redacted value for a table cell. */
export function formatValue(value: Redacted): string {
  if (value === null) return "—";
  if (typeof value === "string") return value === "" ? '""' : value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : value.map(formatValue).join(", ");
  }
  return JSON.stringify(value);
}

/**
 * One line describing a change set, for the collapsed row in the admin table.
 *
 * Names up to three fields, then counts the rest — an admin scanning the log
 * wants to know roughly what moved, and can expand for the detail.
 */
export function summarizeChanges(changes: readonly FieldChange[]): string {
  if (changes.length === 0) return "No field changes recorded";

  const named = changes.slice(0, 3).map((change) => change.path);
  const remaining = changes.length - named.length;

  if (remaining <= 0) return named.join(", ");
  return `${named.join(", ")} +${remaining} more`;
}

/**
 * Trim a snapshot down to the fields worth recording before it is redacted.
 *
 * Callers pass the columns that matter for the action; everything else is
 * dropped so the log stays readable and small.
 */
export function pick<T extends object, K extends keyof T>(
  source: T | null | undefined,
  keys: readonly K[],
): Pick<T, K> | null {
  if (!source) return null;
  const out = {} as Pick<T, K>;
  for (const key of keys) {
    out[key] = source[key];
  }
  return out;
}
