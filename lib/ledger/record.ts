/**
 * Appending to the earnings ledger.
 *
 * Every code path that moves `writer_earnings` should append here too. The
 * unique index on (entry_type, source_type, source_id) makes that safe to call
 * from paths that fire more than once — the grant path runs from both
 * verify-payment and the Razorpay webhook, and only the first write lands.
 *
 * Nothing in here throws at the caller. A ledger write failing must never turn
 * a successful purchase into a failed one; the reconciliation script is the
 * backstop that notices if one goes missing.
 */

import { db } from "@/lib/db";
import { earningsLedger } from "@/lib/db/schema";
import type { LedgerEntryType } from "./compute";

export type RecordInput = {
  writerId: string;
  entryType: LedgerEntryType;
  /**
   * Magnitude in paise, always positive. The sign is applied here from the
   * entry type so no caller has to remember which way round a refund goes.
   */
  amountCents: number;
  sourceType: "purchase" | "bundle_purchase" | "payout" | "manual";
  sourceId?: string | null;
  memo?: string | null;
  occurredAt?: Date;
};

/** Entry types that reduce a writer's balance. */
const DEBIT_TYPES: ReadonlySet<LedgerEntryType> = new Set(["refund", "payout"]);

/**
 * Apply the sign an entry type implies.
 *
 * `adjustment` is the exception: admins pass it already signed, because an
 * adjustment can go either way.
 */
export function signedFor(
  entryType: LedgerEntryType,
  amountCents: number,
): number {
  if (entryType === "adjustment") return amountCents;
  const magnitude = Math.abs(amountCents);
  return DEBIT_TYPES.has(entryType) ? -magnitude : magnitude;
}

/**
 * Append one entry. Returns true when a row was written, false when an
 * identical (type, source) entry already existed.
 */
export async function recordLedgerEntry(input: RecordInput): Promise<boolean> {
  if (!Number.isFinite(input.amountCents) || input.amountCents === 0) {
    return false;
  }

  try {
    const inserted = await db
      .insert(earningsLedger)
      .values({
        writerId: input.writerId,
        entryType: input.entryType,
        amountCents: signedFor(input.entryType, input.amountCents),
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        memo: input.memo ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      })
      .onConflictDoNothing({
        target: [
          earningsLedger.entryType,
          earningsLedger.sourceType,
          earningsLedger.sourceId,
        ],
      })
      .returning({ id: earningsLedger.id });

    return inserted.length > 0;
  } catch (err) {
    console.error("[ledger] failed to append entry", {
      writerId: input.writerId,
      entryType: input.entryType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      err,
    });
    return false;
  }
}

/** Append several entries, one per writer on a bundle. */
export async function recordLedgerEntries(
  inputs: readonly RecordInput[],
): Promise<number> {
  let written = 0;
  for (const input of inputs) {
    if (await recordLedgerEntry(input)) written += 1;
  }
  return written;
}
