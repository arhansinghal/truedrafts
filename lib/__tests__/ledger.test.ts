import { describe, it, expect } from "vitest";
import {
  CREDIT_TYPES,
  ENTRY_LABELS,
  HOLD_DAYS,
  computeBalances,
  groupByMonth,
  monthKey,
  monthLabel,
  monthRange,
  netTotal,
  parseMonthKey,
  reconcile,
  summarize,
  withRunningBalance,
  type LedgerEntry,
  type LedgerEntryType,
} from "../ledger/compute";
import { signedFor } from "../ledger/record";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

let seq = 0;
function entry(
  entryType: LedgerEntryType,
  amountCents: number,
  occurredAt: string | Date,
  memo = "",
): LedgerEntry {
  seq += 1;
  return {
    id: `entry-${seq}`,
    entryType,
    amountCents,
    sourceType: "purchase",
    sourceId: `src-${seq}`,
    memo,
    occurredAt:
      typeof occurredAt === "string" ? new Date(occurredAt) : occurredAt,
  };
}

/** An instant comfortably outside the hold window. */
function longAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

describe("signedFor", () => {
  it("makes credits positive whatever the caller passes", () => {
    expect(signedFor("sale", 25_000)).toBe(25_000);
    expect(signedFor("sale", -25_000)).toBe(25_000);
    expect(signedFor("payout_reversal", 100_000)).toBe(100_000);
  });

  it("makes debits negative whatever the caller passes", () => {
    expect(signedFor("payout", 100_000)).toBe(-100_000);
    expect(signedFor("payout", -100_000)).toBe(-100_000);
    expect(signedFor("refund", 25_000)).toBe(-25_000);
  });

  it("leaves adjustments exactly as passed", () => {
    expect(signedFor("adjustment", 500)).toBe(500);
    expect(signedFor("adjustment", -500)).toBe(-500);
  });
});

describe("CREDIT_TYPES", () => {
  it("covers only the types that add to a balance", () => {
    expect(CREDIT_TYPES.has("sale")).toBe(true);
    expect(CREDIT_TYPES.has("payout_reversal")).toBe(true);
    expect(CREDIT_TYPES.has("refund")).toBe(false);
    expect(CREDIT_TYPES.has("payout")).toBe(false);
  });

  it("has a label for every entry type", () => {
    const types: LedgerEntryType[] = [
      "sale",
      "refund",
      "payout",
      "payout_reversal",
      "adjustment",
    ];
    for (const t of types) {
      expect(ENTRY_LABELS[t]).toBeTruthy();
    }
  });
});

describe("month keys", () => {
  it("formats a UTC instant", () => {
    expect(monthKey(NOW)).toBe("2026-09");
    expect(monthKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
  });

  it("parses a well-formed key", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthKey("2026-01")).toEqual({ year: 2026, month: 1 });
    expect(parseMonthKey("2026-12")).toEqual({ year: 2026, month: 12 });
  });

  it("rejects anything malformed or out of range", () => {
    expect(parseMonthKey("2026-13")).toBe(null);
    expect(parseMonthKey("2026-00")).toBe(null);
    expect(parseMonthKey("2026-9")).toBe(null);
    expect(parseMonthKey("not-a-month")).toBe(null);
    expect(parseMonthKey("1066-09")).toBe(null);
    expect(parseMonthKey("../../etc")).toBe(null);
  });

  it("labels a month in words", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthLabel("garbage")).toBe("garbage");
  });
});

describe("monthRange", () => {
  it("starts at midnight UTC on the first", () => {
    const { start } = monthRange(2026, 9);
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("ends on the last day of the month", () => {
    expect(monthRange(2026, 9).end.getUTCDate()).toBe(30);
    expect(monthRange(2026, 1).end.getUTCDate()).toBe(31);
    expect(monthRange(2026, 2).end.getUTCDate()).toBe(28);
  });

  it("knows about leap years", () => {
    expect(monthRange(2028, 2).end.getUTCDate()).toBe(29);
  });

  it("stays inside the month it was asked for", () => {
    const { start, end } = monthRange(2026, 9);
    expect(start.getUTCMonth()).toBe(8);
    expect(end.getUTCMonth()).toBe(8);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("netTotal", () => {
  it("is zero for an empty ledger", () => {
    expect(netTotal([])).toBe(0);
  });

  it("sums signed amounts", () => {
    const entries = [
      entry("sale", 25_000, longAgo(30)),
      entry("sale", 25_000, longAgo(20)),
      entry("refund", -25_000, longAgo(15)),
      entry("payout", -10_000, longAgo(10)),
    ];
    expect(netTotal(entries)).toBe(15_000);
  });
});

describe("withRunningBalance", () => {
  it("returns an empty list unchanged", () => {
    expect(withRunningBalance([])).toEqual([]);
  });

  it("carries a balance forward, oldest first", () => {
    const rows = withRunningBalance([
      entry("sale", 25_000, "2026-09-03T10:00:00.000Z"),
      entry("sale", 40_000, "2026-09-10T10:00:00.000Z"),
      entry("payout", -50_000, "2026-09-12T10:00:00.000Z"),
    ]);
    expect(rows.map((r) => r.balanceAfter)).toEqual([25_000, 65_000, 15_000]);
  });

  it("sorts out-of-order entries before accumulating", () => {
    const rows = withRunningBalance([
      entry("payout", -50_000, "2026-09-12T10:00:00.000Z"),
      entry("sale", 25_000, "2026-09-03T10:00:00.000Z"),
      entry("sale", 40_000, "2026-09-10T10:00:00.000Z"),
    ]);
    expect(rows[0].amountCents).toBe(25_000);
    expect(rows[rows.length - 1].balanceAfter).toBe(15_000);
  });

  it("continues from an opening balance", () => {
    const rows = withRunningBalance(
      [entry("sale", 25_000, "2026-09-03T10:00:00.000Z")],
      100_000,
    );
    expect(rows[0].balanceAfter).toBe(125_000);
  });

  it("does not mutate the input array's order", () => {
    const entries = [
      entry("payout", -50_000, "2026-09-12T10:00:00.000Z"),
      entry("sale", 25_000, "2026-09-03T10:00:00.000Z"),
    ];
    const firstBefore = entries[0].id;
    withRunningBalance(entries);
    expect(entries[0].id).toBe(firstBefore);
  });
});

describe("computeBalances", () => {
  it("is all zeroes for an empty ledger", () => {
    expect(computeBalances([], NOW)).toEqual({
      availableCents: 0,
      pendingCents: 0,
      totalEarnedCents: 0,
    });
  });

  it("makes a sale withdrawable once the hold has elapsed", () => {
    const balances = computeBalances(
      [entry("sale", 25_000, longAgo(HOLD_DAYS + 1))],
      NOW,
    );
    expect(balances.availableCents).toBe(25_000);
    expect(balances.pendingCents).toBe(0);
  });

  it("holds a sale that is still inside the window", () => {
    const balances = computeBalances([entry("sale", 25_000, longAgo(1))], NOW);
    expect(balances.availableCents).toBe(0);
    expect(balances.pendingCents).toBe(25_000);
  });

  it("splits a mix of cleared and clearing sales", () => {
    const balances = computeBalances(
      [
        entry("sale", 25_000, longAgo(30)),
        entry("sale", 40_000, longAgo(2)),
      ],
      NOW,
    );
    expect(balances.availableCents).toBe(25_000);
    expect(balances.pendingCents).toBe(40_000);
    expect(balances.totalEarnedCents).toBe(65_000);
  });

  it("counts lifetime earnings from credits only", () => {
    const balances = computeBalances(
      [
        entry("sale", 25_000, longAgo(30)),
        entry("refund", -25_000, longAgo(29)),
        entry("payout", -10_000, longAgo(28)),
      ],
      NOW,
    );
    expect(balances.totalEarnedCents).toBe(25_000);
  });

  it("nets settled debits against settled credits", () => {
    const balances = computeBalances(
      [
        entry("sale", 100_000, longAgo(40)),
        entry("payout", -60_000, longAgo(30)),
      ],
      NOW,
    );
    expect(balances.availableCents).toBe(40_000);
  });
});

describe("summarize", () => {
  it("is all zeroes for an empty period", () => {
    const summary = summarize([]);
    expect(summary.earnedCents).toBe(0);
    expect(summary.refundedCents).toBe(0);
    expect(summary.paidOutCents).toBe(0);
    expect(summary.netCents).toBe(0);
  });

  it("totals sales and counts them", () => {
    const summary = summarize([
      entry("sale", 25_000, longAgo(10)),
      entry("sale", 40_000, longAgo(9)),
    ]);
    expect(summary.earnedCents).toBe(65_000);
    expect(summary.saleCount).toBe(2);
    expect(summary.netCents).toBe(65_000);
  });

  it("reports refunds and payouts as positive magnitudes", () => {
    const summary = summarize([
      entry("sale", 60_000, longAgo(10)),
      entry("refund", -25_000, longAgo(8)),
      entry("payout", -10_000, longAgo(5)),
    ]);
    expect(summary.refundedCents).toBe(25_000);
    expect(summary.paidOutCents).toBe(10_000);
    expect(summary.refundCount).toBe(1);
  });

  it("nets sales against payouts", () => {
    const summary = summarize([
      entry("sale", 100_000, longAgo(10)),
      entry("payout", -30_000, longAgo(5)),
    ]);
    expect(summary.netCents).toBe(70_000);
  });

  it("ignores adjustments and reversals in the headline rows", () => {
    const summary = summarize([
      entry("adjustment", 500, longAgo(3)),
      entry("payout_reversal", 10_000, longAgo(2)),
    ]);
    expect(summary.earnedCents).toBe(0);
    expect(summary.refundedCents).toBe(0);
    expect(summary.paidOutCents).toBe(0);
  });
});

describe("groupByMonth", () => {
  it("buckets by UTC month, newest first", () => {
    const groups = groupByMonth([
      entry("sale", 10_000, "2026-07-14T10:00:00.000Z"),
      entry("sale", 20_000, "2026-09-02T10:00:00.000Z"),
      entry("sale", 30_000, "2026-09-18T10:00:00.000Z"),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["2026-09", "2026-07"]);
    expect(groups[0].entries).toHaveLength(2);
  });

  it("orders entries inside a bucket oldest first", () => {
    const groups = groupByMonth([
      entry("sale", 30_000, "2026-09-18T10:00:00.000Z"),
      entry("sale", 20_000, "2026-09-02T10:00:00.000Z"),
    ]);
    expect(groups[0].entries[0].amountCents).toBe(20_000);
  });

  it("returns nothing for an empty ledger", () => {
    expect(groupByMonth([])).toEqual([]);
  });
});

describe("reconcile", () => {
  const entries = [
    entry("sale", 100_000, longAgo(40)),
    entry("payout", -60_000, longAgo(30)),
  ];

  it("reports no drift when the snapshot agrees", () => {
    const result = reconcile(
      entries,
      { availableCents: 40_000, pendingCents: 0, totalEarnedCents: 100_000 },
      NOW,
    );
    expect(result.ok).toBe(true);
    expect(result.availableDriftCents).toBe(0);
    expect(result.totalEarnedDriftCents).toBe(0);
  });

  it("reports the size and direction of drift", () => {
    const result = reconcile(
      entries,
      { availableCents: 45_000, pendingCents: 0, totalEarnedCents: 100_000 },
      NOW,
    );
    expect(result.ok).toBe(false);
    expect(result.availableDriftCents).toBe(5_000);
  });

  it("treats a missing snapshot as all zeroes", () => {
    const result = reconcile(
      [],
      { availableCents: 0, pendingCents: 0, totalEarnedCents: 0 },
      NOW,
    );
    expect(result.ok).toBe(true);
  });
});
