/**
 * Pure arithmetic over earnings-ledger entries.
 *
 * No database access here — the statement and reconciliation code pulls rows
 * and hands them to these functions, so every number a writer sees is derived
 * by code that can be tested against a fixed array.
 *
 * Amounts are signed INR paise: credits positive, debits negative. Adding a
 * ledger up is literally a sum.
 */

export type LedgerEntryType =
  | "sale"
  | "refund"
  | "payout"
  | "payout_reversal"
  | "adjustment";

export type LedgerEntry = {
  id: string;
  entryType: LedgerEntryType;
  /** Signed: credits positive, debits negative. */
  amountCents: number;
  sourceType: string;
  sourceId: string | null;
  memo: string | null;
  occurredAt: Date;
};

/**
 * How long a sale sits before a writer can withdraw it.
 *
 * Matches the window in which a buyer can raise a dispute — paying out money
 * we might have to claw back has already bitten us once.
 */
export const HOLD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
export const HOLD_MS = HOLD_DAYS * DAY_MS;

/** Entry types that add to a writer's balance. */
export const CREDIT_TYPES: ReadonlySet<LedgerEntryType> = new Set([
  "sale",
  "payout_reversal",
]);

/** Human label for each entry type, used on the statement. */
export const ENTRY_LABELS: Record<LedgerEntryType, string> = {
  sale: "Sale",
  refund: "Refund",
  payout: "Payout",
  payout_reversal: "Payout reversed",
  adjustment: "Adjustment",
};

/**
 * A closed, inclusive UTC range for a calendar month.
 *
 * `month` is 1-based, the way humans and `YYYY-MM` keys write it.
 */
export function monthRange(
  year: number,
  month: number,
): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  // Day zero of the following month is the last day of this one.
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

/** `YYYY-MM` for an instant, in UTC. */
export function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Parse a `YYYY-MM` key. Returns null for anything malformed. */
export function parseMonthKey(
  key: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2200) return null;
  return { year, month };
}

/** Human month label, e.g. `2026-09` → `September 2026`. */
export function monthLabel(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, 1)).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
}

/** Sum of every entry — the writer's lifetime net position. */
export function netTotal(entries: readonly LedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

export type RunningRow = LedgerEntry & { balanceAfter: number };

/**
 * Attach a running balance to each entry, oldest first.
 *
 * `openingBalance` is everything that happened before the first entry in the
 * slice, so a single month's statement still shows real balances rather than
 * starting from zero.
 */
export function withRunningBalance(
  entries: readonly LedgerEntry[],
  openingBalance = 0,
): RunningRow[] {
  const ordered = [...entries].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  let balance = openingBalance;
  return ordered.map((entry) => {
    balance += entry.amountCents;
    return { ...entry, balanceAfter: balance };
  });
}

export type Balances = {
  /** Withdrawable right now. */
  availableCents: number;
  /** Earned but still inside the hold window. */
  pendingCents: number;
  /** Lifetime credits, before any debits. */
  totalEarnedCents: number;
};

/**
 * Split a ledger into what a writer can withdraw today and what is still
 * clearing.
 *
 * Only sales are held — money leaving the balance (a payout, a refund) applies
 * the moment it happens, because it has already happened.
 */
export function computeBalances(
  entries: readonly LedgerEntry[],
  now: Date = new Date(),
): Balances {
  let availableCents = 0;
  let pendingCents = 0;
  let totalEarnedCents = 0;

  for (const entry of entries) {
    if (CREDIT_TYPES.has(entry.entryType) && entry.amountCents > 0) {
      totalEarnedCents += entry.amountCents;
    }

    const clearedAt = entry.occurredAt.getTime() + HOLD_MS;
    if (clearedAt <= now.getTime()) {
      availableCents += entry.amountCents;
    } else {
      pendingCents += entry.amountCents;
    }
  }

  return { availableCents, pendingCents, totalEarnedCents };
}

export type StatementSummary = {
  /** Gross credits from sales. */
  earnedCents: number;
  /** Total clawed back by refunds, as a positive number. */
  refundedCents: number;
  /** Total withdrawn, as a positive number. */
  paidOutCents: number;
  /** Net movement across the period. */
  netCents: number;
  saleCount: number;
  refundCount: number;
};

/**
 * Roll a period's entries up into the numbers at the top of a statement.
 *
 * Refunds and payouts are reported as positive magnitudes because that is how
 * they read on a statement ("Refunds ₹500"), even though they are stored
 * negative.
 */
export function summarize(entries: readonly LedgerEntry[]): StatementSummary {
  let earnedCents = 0;
  let refundedCents = 0;
  let paidOutCents = 0;
  let saleCount = 0;
  let refundCount = 0;

  for (const entry of entries) {
    switch (entry.entryType) {
      case "sale":
        earnedCents += entry.amountCents;
        saleCount += 1;
        break;
      case "refund":
        refundedCents += Math.abs(entry.amountCents);
        refundCount += 1;
        break;
      case "payout":
        paidOutCents += Math.abs(entry.amountCents);
        break;
      default:
        break;
    }
  }

  return {
    earnedCents,
    refundedCents,
    paidOutCents,
    netCents: earnedCents + refundedCents - paidOutCents,
    saleCount,
    refundCount,
  };
}

/** Group entries into `YYYY-MM` buckets, newest month first. */
export function groupByMonth(
  entries: readonly LedgerEntry[],
): { key: string; entries: LedgerEntry[] }[] {
  const byKey = new Map<string, LedgerEntry[]>();

  for (const entry of entries) {
    const key = monthKey(entry.occurredAt);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(entry);
    else byKey.set(key, [entry]);
  }

  return Array.from(byKey.entries())
    .map(([key, list]) => ({
      key,
      entries: list.sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      ),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Does the ledger agree with the denormalised totals on `writer_earnings`?
 *
 * Used by the reconciliation script and surfaced to admins. A non-zero drift
 * means a code path moved a balance without appending an entry.
 */
export function reconcile(
  entries: readonly LedgerEntry[],
  snapshot: { availableCents: number; pendingCents: number; totalEarnedCents: number },
  now: Date = new Date(),
): {
  ok: boolean;
  availableDriftCents: number;
  pendingDriftCents: number;
  totalEarnedDriftCents: number;
} {
  const derived = computeBalances(entries, now);
  const availableDriftCents = snapshot.availableCents - derived.availableCents;
  const pendingDriftCents = snapshot.pendingCents - derived.pendingCents;
  const totalEarnedDriftCents =
    snapshot.totalEarnedCents - derived.totalEarnedCents;

  return {
    ok:
      availableDriftCents === 0 &&
      pendingDriftCents === 0 &&
      totalEarnedDriftCents === 0,
    availableDriftCents,
    pendingDriftCents,
    totalEarnedDriftCents,
  };
}
