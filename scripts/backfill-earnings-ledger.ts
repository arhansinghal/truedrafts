/**
 * Create the earnings_ledger table and backfill it from history.
 *
 * Run with:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-earnings-ledger.ts
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/backfill-earnings-ledger.ts --check
 *
 * Without --check it creates the table (idempotent) and replays every existing
 * purchase and payout into it, stamping `occurred_at` with the original date so
 * historical statements read correctly rather than all landing on today.
 *
 * With --check it only reports drift between the ledger and writer_earnings,
 * which is the query to run if a writer ever says their balance looks wrong.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function ensureTable() {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type') THEN
        CREATE TYPE ledger_entry_type AS ENUM
          ('sale', 'refund', 'payout', 'payout_reversal', 'adjustment');
      END IF;
    END
    $$
  `;
  console.log("  ✓ ledger_entry_type enum ensured");

  await sql`
    CREATE TABLE IF NOT EXISTS earnings_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      writer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_type ledger_entry_type NOT NULL,
      amount_cents integer NOT NULL,
      source_type text NOT NULL,
      source_id text,
      memo text,
      occurred_at timestamp NOT NULL DEFAULT now(),
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ earnings_ledger table ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_earnings_ledger_writer_time
    ON earnings_ledger (writer_id, occurred_at)
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_earnings_ledger_source
    ON earnings_ledger (entry_type, source_type, source_id)
  `;
  console.log("  ✓ indexes ensured");
}

async function backfillSales() {
  // Single-item purchases (essay or application). Bundle children carry a real
  // writer_payout_cents too, so they're included by the same query.
  const rows = await sql`
    INSERT INTO earnings_ledger
      (writer_id, entry_type, amount_cents, source_type, source_id, memo, occurred_at)
    SELECT
      COALESCE(ca.writer_id, e.writer_id),
      'sale',
      p.writer_payout_cents,
      'purchase',
      p.id::text,
      CASE WHEN p.bundle_purchase_id IS NOT NULL THEN 'Bundle sale' ELSE 'Sale' END,
      COALESCE(p.purchased_at, now())
    FROM purchases p
    LEFT JOIN college_applications ca ON ca.id = p.application_id
    LEFT JOIN essays e ON e.id = p.essay_id
    WHERE p.status = 'completed'
      AND p.writer_payout_cents > 0
      AND COALESCE(ca.writer_id, e.writer_id) IS NOT NULL
    ON CONFLICT (entry_type, source_type, source_id) DO NOTHING
    RETURNING id
  `;
  console.log(`  ✓ ${rows.length} sale entries`);
}

async function backfillRefunds() {
  const rows = await sql`
    INSERT INTO earnings_ledger
      (writer_id, entry_type, amount_cents, source_type, source_id, memo, occurred_at)
    SELECT
      COALESCE(ca.writer_id, e.writer_id),
      'refund',
      -p.writer_payout_cents,
      'purchase',
      p.id::text,
      'Purchase refunded',
      COALESCE(p.purchased_at, now())
    FROM purchases p
    LEFT JOIN college_applications ca ON ca.id = p.application_id
    LEFT JOIN essays e ON e.id = p.essay_id
    WHERE p.status = 'refunded'
      AND p.writer_payout_cents > 0
      AND COALESCE(ca.writer_id, e.writer_id) IS NOT NULL
    ON CONFLICT (entry_type, source_type, source_id) DO NOTHING
    RETURNING id
  `;
  console.log(`  ✓ ${rows.length} refund entries`);
}

async function backfillPayouts() {
  const rows = await sql`
    INSERT INTO earnings_ledger
      (writer_id, entry_type, amount_cents, source_type, source_id, memo, occurred_at)
    SELECT
      writer_id,
      'payout',
      -amount_cents,
      'payout',
      id::text,
      'Payout requested',
      COALESCE(requested_at, now())
    FROM payouts
    WHERE status <> 'failed'
    ON CONFLICT (entry_type, source_type, source_id) DO NOTHING
    RETURNING id
  `;
  console.log(`  ✓ ${rows.length} payout entries`);
}

async function report() {
  const rows = (await sql`
    SELECT
      we.writer_id,
      we.total_earned_cents,
      we.available_cents,
      we.pending_cents,
      COALESCE(SUM(el.amount_cents) FILTER (WHERE el.entry_type = 'sale'), 0)::int AS ledger_earned,
      COALESCE(SUM(el.amount_cents), 0)::int AS ledger_net
    FROM writer_earnings we
    LEFT JOIN earnings_ledger el ON el.writer_id = we.writer_id
    GROUP BY we.writer_id, we.total_earned_cents, we.available_cents, we.pending_cents
    ORDER BY we.total_earned_cents DESC
  `) as {
    writer_id: string;
    total_earned_cents: number;
    available_cents: number;
    pending_cents: number;
    ledger_earned: number;
    ledger_net: number;
  }[];

  let drifted = 0;
  for (const row of rows) {
    const earnedDrift = row.total_earned_cents - row.ledger_earned;
    const balanceDrift =
      row.available_cents + row.pending_cents - row.ledger_net;
    if (earnedDrift !== 0 || balanceDrift !== 0) {
      drifted += 1;
      console.log(
        `  ⚠ ${row.writer_id}: earned drift ${earnedDrift}, balance drift ${balanceDrift}`,
      );
    }
  }

  console.log(
    `\n${rows.length} writers checked, ${drifted} with drift.${
      drifted === 0 ? " Ledger agrees with writer_earnings." : ""
    }`,
  );
}

async function main() {
  const checkOnly = process.argv.includes("--check");

  if (checkOnly) {
    await report();
    return;
  }

  await ensureTable();
  await backfillSales();
  await backfillRefunds();
  await backfillPayouts();
  await report();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
