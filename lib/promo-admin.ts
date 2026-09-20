/**
 * Shared plumbing for the two admin promo-code routes.
 *
 * Lives here rather than in either route file because App Router route modules
 * may only export HTTP method handlers.
 */

import { db } from "@/lib/db";
import { promoCodes } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";

/** Parse an optional integer field from the admin form. "" and null → null. */
export function optionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/**
 * Parse an optional date field. Invalid input returns null; `validateTermsInput`
 * is what actually rejects it, so the two never disagree about what "invalid"
 * means.
 */
export function optionalDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Narrow the free-form scope field coming off the admin form. */
export function parseScope(
  value: unknown,
): "all" | "applications" | "essays" | "bundles" {
  if (value === "applications" || value === "essays" || value === "bundles") {
    return value;
  }
  return "all";
}

/** True when some *other* code already owns this string. */
export async function codeExistsElsewhere(
  code: string,
  excludingId: string,
): Promise<boolean> {
  const row = await db.query.promoCodes.findFirst({
    where: and(eq(promoCodes.code, code), ne(promoCodes.id, excludingId)),
    columns: { id: true },
  });
  return !!row;
}
