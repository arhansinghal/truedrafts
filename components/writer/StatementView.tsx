"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { ENTRY_LABELS, type LedgerEntryType } from "@/lib/ledger/compute";
import { StatCard } from "@/components/writer/Manuscript";

type MonthOption = {
  key: string;
  label: string;
  netCents: number;
  entryCount: number;
};

type StatementRow = {
  id: string;
  entryType: LedgerEntryType;
  amountCents: number;
  memo: string | null;
  occurredAt: string;
  balanceAfter: number;
};

type Statement = {
  month: string;
  label: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  summary: {
    earnedCents: number;
    refundedCents: number;
    paidOutCents: number;
    netCents: number;
    saleCount: number;
    refundCount: number;
  };
  rows: StatementRow[];
};

type Overview = {
  months: MonthOption[];
  balances: {
    availableCents: number;
    pendingCents: number;
    totalEarnedCents: number;
  };
};

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Turn the loaded statement into a CSV a writer can hand to an accountant. */
function toCsv(statement: Statement): string {
  const header = "date,type,memo,amount_inr,balance_inr";
  const lines = statement.rows.map((row) =>
    [
      new Date(row.occurredAt).toISOString().slice(0, 10),
      ENTRY_LABELS[row.entryType],
      `"${(row.memo ?? "").replace(/"/g, '""')}"`,
      (row.amountCents / 100).toFixed(2),
      (row.balanceAfter / 100).toFixed(2),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function StatementView({ initialMonth }: { initialMonth: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [month, setMonth] = useState(initialMonth);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/writer/statements");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Overview;
        if (cancelled) return;
        setOverview(data);
        // Default to the most recent month that actually has activity.
        if (data.months.length > 0 && !data.months.some((m) => m.key === month)) {
          setMonth(data.months[0].key);
        }
      } catch (err) {
        if (!cancelled) console.error("[ledger] overview fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once: the month it might set is derived from the response itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStatement = useCallback(async (key: string, signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/writer/statements/${key}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatement((await res.json()) as Statement);
    } catch (err) {
      if (signal.aborted) return;
      console.error("[ledger] statement fetch failed", err);
      setError("Couldn't load that statement.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadStatement(month, controller.signal);
    return () => controller.abort();
  }, [month, loadStatement]);

  function download() {
    if (!statement) return;
    const blob = new Blob([toCsv(statement)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `truedrafts-statement-${statement.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {overview && (
        <div className="mb-[22px] grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Wallet}
            tone="blue"
            label="Available"
            value={formatCents(overview.balances.availableCents)}
            sub="ready to withdraw"
          />
          <StatCard
            icon={ArrowDownLeft}
            label="Clearing"
            value={formatCents(overview.balances.pendingCents)}
            sub="still inside the 7-day hold"
          />
          <StatCard
            icon={ArrowUpRight}
            tone="emerald"
            label="Lifetime earned"
            value={formatCents(overview.balances.totalEarnedCents)}
            sub="before refunds and payouts"
          />
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-[10px] px-3 py-2 text-sm"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink)",
          }}
          aria-label="Statement month"
        >
          {(overview?.months ?? [{ key: month, label: month, netCents: 0, entryCount: 0 }]).map(
            (m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.entryCount})
              </option>
            ),
          )}
        </select>

        <button
          type="button"
          onClick={download}
          disabled={!statement || statement.rows.length === 0}
          className="inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--ink-soft)",
          }}
        >
          <Download className="h-[15px] w-[15px]" />
          Download CSV
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded-[10px] px-4 py-3 text-[13px]"
          style={{ background: "var(--red-wash)", color: "var(--td-red)" }}
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && (
        <p className="py-10 text-center text-sm" style={{ color: "var(--ink-faint)" }}>
          Loading…
        </p>
      )}

      {!loading && statement && (
        <>
          <div
            className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] sm:grid-cols-4"
            style={{ background: "var(--line)", border: "1px solid var(--line)" }}
          >
            <SummaryCell
              label="Earned"
              value={formatCents(statement.summary.earnedCents)}
              sub={`${statement.summary.saleCount} sale${statement.summary.saleCount === 1 ? "" : "s"}`}
            />
            <SummaryCell
              label="Refunded"
              value={formatCents(statement.summary.refundedCents)}
              sub={`${statement.summary.refundCount} refund${statement.summary.refundCount === 1 ? "" : "s"}`}
            />
            <SummaryCell
              label="Paid out"
              value={formatCents(statement.summary.paidOutCents)}
              sub="withdrawn"
            />
            <SummaryCell
              label="Net"
              value={formatCents(statement.summary.netCents)}
              sub="this month"
              emphasis
            />
          </div>

          <div
            className="overflow-hidden rounded-[14px]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr style={{ background: "var(--paper-2)" }}>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th>Detail</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td
                      colSpan={4}
                      className="px-4 py-2.5 text-[12.5px] italic"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      Opening balance
                    </td>
                    <td
                      className="px-4 py-2.5 text-right text-[13px] tabular-nums"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      {formatCents(statement.openingBalanceCents)}
                    </td>
                  </tr>

                  {statement.rows.map((row) => {
                    const credit = row.amountCents >= 0;
                    return (
                      <tr
                        key={row.id}
                        style={{ borderTop: "1px solid var(--line-soft)" }}
                      >
                        <td
                          className="px-4 py-3 text-[13px] whitespace-nowrap"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {formatDay(row.occurredAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="rounded-full px-2 py-[2px] text-[11.5px] font-semibold"
                            style={{
                              background: credit
                                ? "var(--emerald-wash)"
                                : "var(--paper-2)",
                              color: credit
                                ? "var(--emerald)"
                                : "var(--ink-soft)",
                            }}
                          >
                            {ENTRY_LABELS[row.entryType]}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-[13px]"
                          style={{ color: "var(--ink-soft)" }}
                        >
                          {row.memo ?? "—"}
                        </td>
                        <td
                          className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums"
                          style={{
                            color: credit ? "var(--emerald)" : "var(--td-red)",
                          }}
                        >
                          {credit ? "+" : "−"}
                          {formatCents(Math.abs(row.amountCents))}
                        </td>
                        <td
                          className="px-4 py-3 text-right text-[13px] tabular-nums"
                          style={{ color: "var(--ink)" }}
                        >
                          {formatCents(row.balanceAfter)}
                        </td>
                      </tr>
                    );
                  })}

                  {statement.rows.length === 0 && (
                    <tr style={{ borderTop: "1px solid var(--line-soft)" }}>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-[13px]"
                        style={{ color: "var(--ink-faint)" }}
                      >
                        Nothing moved in {statement.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className="px-4 py-3 text-[11.5px] font-semibold uppercase tracking-[0.06em]"
      style={{ color: "var(--ink-faint)", textAlign: align }}
    >
      {children}
    </th>
  );
}

function SummaryCell({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: string;
  value: string;
  sub: string;
  emphasis?: boolean;
}) {
  return (
    <div className="p-4" style={{ background: "var(--surface)" }}>
      <div
        className="text-[11.5px] font-semibold uppercase tracking-[0.06em]"
        style={{ color: "var(--ink-faint)" }}
      >
        {label}
      </div>
      <div
        className={emphasis ? "serif mt-1 text-[22px] font-semibold" : "mt-1 text-[18px] font-semibold"}
        style={{ color: "var(--ink)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--ink-faint)" }}>
        {sub}
      </div>
    </div>
  );
}
