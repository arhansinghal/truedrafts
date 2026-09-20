/**
 * Reading the earnings ledger: monthly statements and the balance a writer
 * sees on their payout page.
 */

import { db } from "@/lib/db";
import { earningsLedger, writerEarnings } from "@/lib/db/schema";
import { and, asc, eq, lt, lte, sql } from "drizzle-orm";

import {
  computeBalances,
  monthKey,
  monthLabel,
  monthRange,
  netTotal,
  reconcile,
  summarize,
  withRunningBalance,
  type Balances,
  type LedgerEntry,
  type RunningRow,
  type StatementSummary,
} from "./compute";

function toEntry(row: typeof earningsLedger.$inferSelect): LedgerEntry {
  return {
    id: row.id,
    entryType: row.entryType,
    amountCents: row.amountCents,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    memo: row.memo,
    occurredAt: row.occurredAt,
  };
}

/** Every entry for a writer, oldest first. */
export async function loadLedger(writerId: string): Promise<LedgerEntry[]> {
  const rows = await db
    .select()
    .from(earningsLedger)
    .where(eq(earningsLedger.writerId, writerId))
    .orderBy(asc(earningsLedger.occurredAt));
  return rows.map(toEntry);
}

/** The months a writer has any activity in, newest first. */
export async function availableMonths(writerId: string): Promise<
  { key: string; label: string; netCents: number; entryCount: number }[]
> {
  const rows = await db
    .select({
      key: sql<string>`to_char(${earningsLedger.occurredAt}, 'YYYY-MM')`,
      netCents: sql<number>`coalesce(sum(${earningsLedger.amountCents}), 0)::int`,
      entryCount: sql<number>`count(*)::int`,
    })
    .from(earningsLedger)
    .where(eq(earningsLedger.writerId, writerId))
    .groupBy(sql`to_char(${earningsLedger.occurredAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${earningsLedger.occurredAt}, 'YYYY-MM') DESC`);

  return rows.map((row) => ({
    key: row.key,
    label: monthLabel(row.key),
    netCents: row.netCents,
    entryCount: row.entryCount,
  }));
}

export type Statement = {
  month: string;
  label: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  summary: StatementSummary;
  rows: RunningRow[];
};

/**
 * One month's statement.
 *
 * The opening balance is everything that happened strictly before the month
 * started, so the running balance column continues from the previous statement
 * rather than restarting at zero.
 */
export async function buildStatement(
  writerId: string,
  year: number,
  month: number,
): Promise<Statement> {
  const { start, end } = monthRange(year, month);

  const [priorRows, monthRows] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(${earningsLedger.amountCents}), 0)::int`,
      })
      .from(earningsLedger)
      .where(
        and(
          eq(earningsLedger.writerId, writerId),
          lt(earningsLedger.occurredAt, start),
        ),
      ),
    db
      .select()
      .from(earningsLedger)
      .where(
        and(
          eq(earningsLedger.writerId, writerId),
          sql`${earningsLedger.occurredAt} >= ${start}`,
          lte(earningsLedger.occurredAt, end),
        ),
      )
      .orderBy(asc(earningsLedger.occurredAt)),
  ]);

  const openingBalanceCents = priorRows[0]?.total ?? 0;
  const entries = monthRows.map(toEntry);
  const rows = withRunningBalance(entries, openingBalanceCents);

  return {
    month: `${year}-${String(month).padStart(2, "0")}`,
    label: monthLabel(`${year}-${String(month).padStart(2, "0")}`),
    openingBalanceCents,
    closingBalanceCents: openingBalanceCents + netTotal(entries),
    summary: summarize(entries),
    rows,
  };
}

/** Balances derived from the ledger rather than the denormalised snapshot. */
export async function derivedBalances(
  writerId: string,
  now: Date = new Date(),
): Promise<Balances> {
  return computeBalances(await loadLedger(writerId), now);
}

/**
 * Compare the ledger against `writer_earnings` for one writer. Used by the
 * reconciliation script and the admin writer detail view.
 */
export async function reconcileWriter(
  writerId: string,
  now: Date = new Date(),
): Promise<ReturnType<typeof reconcile> & { writerId: string }> {
  const [entries, snapshot] = await Promise.all([
    loadLedger(writerId),
    db.query.writerEarnings.findFirst({
      where: eq(writerEarnings.writerId, writerId),
    }),
  ]);

  const result = reconcile(
    entries,
    {
      availableCents: snapshot?.availableCents ?? 0,
      pendingCents: snapshot?.pendingCents ?? 0,
      totalEarnedCents: snapshot?.totalEarnedCents ?? 0,
    },
    now,
  );

  return { ...result, writerId };
}

/** The current month's key, for defaulting the statement picker. */
export function currentMonthKey(now: Date = new Date()): string {
  return monthKey(now);
}
