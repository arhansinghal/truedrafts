/**
 * One-shot migration: Stripe/Polar → Razorpay.
 *
 *   - Drops dead provider columns (polar_*, stripe_*).
 *   - Renames the surviving idempotency columns to razorpay-named equivalents.
 *   - Rescales every priceCents/amountCents/bonusCents value by ×100
 *     (USD cents → INR paise display-equivalent).
 *
 * Idempotent: re-running is safe — checks information_schema before each step.
 *
 *   npx tsx scripts/migrate-to-razorpay.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { Pool, neonConfig } from "@neondatabase/serverless";

if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  async function columnExists(table: string, column: string): Promise<boolean> {
    const r = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
      [table, column],
    );
    return r.rowCount! > 0;
  }

  try {
    await client.query("BEGIN");

    // ── 1. Drop dead Polar columns ────────────────────────────────────────────
    if (await columnExists("users", "polar_customer_id")) {
      console.log("DROP users.polar_customer_id");
      await client.query(`ALTER TABLE users DROP COLUMN polar_customer_id`);
    }
    if (await columnExists("essays", "polar_product_id")) {
      console.log("DROP essays.polar_product_id");
      await client.query(`ALTER TABLE essays DROP COLUMN polar_product_id`);
    }
    if (await columnExists("college_applications", "polar_product_id")) {
      console.log("DROP college_applications.polar_product_id");
      await client.query(
        `ALTER TABLE college_applications DROP COLUMN polar_product_id`,
      );
    }

    // ── 2. Rename idempotency columns ─────────────────────────────────────────
    if (await columnExists("purchases", "polar_order_id")) {
      console.log("RENAME purchases.polar_order_id → razorpay_payment_id");
      // Drop the old UNIQUE constraint (any naming variant) then rename.
      await client.query(
        `ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_polar_order_id_unique`,
      );
      await client.query(
        `ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_polar_order_id_key`,
      );
      await client.query(
        `ALTER TABLE purchases RENAME COLUMN polar_order_id TO razorpay_payment_id`,
      );
      await client.query(
        `ALTER TABLE purchases ADD CONSTRAINT purchases_razorpay_payment_id_unique UNIQUE (razorpay_payment_id)`,
      );
    }

    if (await columnExists("payouts", "polar_payout_id")) {
      console.log("RENAME payouts.polar_payout_id → razorpay_payout_id");
      await client.query(
        `ALTER TABLE payouts RENAME COLUMN polar_payout_id TO razorpay_payout_id`,
      );
    }

    if (await columnExists("bundle_purchases", "stripe_session_id")) {
      console.log("RENAME bundle_purchases.stripe_session_id → razorpay_order_id");
      await client.query(
        `ALTER TABLE bundle_purchases DROP CONSTRAINT IF EXISTS bundle_purchases_stripe_session_id_unique`,
      );
      await client.query(
        `ALTER TABLE bundle_purchases DROP CONSTRAINT IF EXISTS bundle_purchases_stripe_session_id_key`,
      );
      await client.query(
        `ALTER TABLE bundle_purchases RENAME COLUMN stripe_session_id TO razorpay_order_id`,
      );
      await client.query(
        `ALTER TABLE bundle_purchases ADD CONSTRAINT bundle_purchases_razorpay_order_id_unique UNIQUE (razorpay_order_id)`,
      );
    }

    if (await columnExists("pending_bundle_checkouts", "stripe_session_id")) {
      console.log(
        "RENAME pending_bundle_checkouts.stripe_session_id → razorpay_order_id",
      );
      await client.query(
        `ALTER TABLE pending_bundle_checkouts DROP CONSTRAINT IF EXISTS pending_bundle_checkouts_stripe_session_id_unique`,
      );
      await client.query(
        `ALTER TABLE pending_bundle_checkouts DROP CONSTRAINT IF EXISTS pending_bundle_checkouts_stripe_session_id_key`,
      );
      await client.query(
        `ALTER TABLE pending_bundle_checkouts RENAME COLUMN stripe_session_id TO razorpay_order_id`,
      );
      await client.query(
        `ALTER TABLE pending_bundle_checkouts ADD CONSTRAINT pending_bundle_checkouts_razorpay_order_id_unique UNIQUE (razorpay_order_id)`,
      );
    }

    // ── 3. Rescale prices ×100 (USD cents → INR paise visual-equivalent) ─────
    // Guarded by a one-time marker row in a tiny housekeeping table so it can
    // never double-apply. Same pattern as a manual migrations table.
    await client.query(
      `CREATE TABLE IF NOT EXISTS _migration_markers (
         name text PRIMARY KEY,
         applied_at timestamp DEFAULT now()
       )`,
    );
    const marker = await client.query(
      `SELECT 1 FROM _migration_markers WHERE name = 'rescale_cents_x100'`,
    );
    if (marker.rowCount === 0) {
      console.log("RESCALE prices ×100 across essays/applications/bundles/earnings/payouts/referrals");
      await client.query(`UPDATE essays SET price_cents = price_cents * 100`);
      await client.query(
        `UPDATE college_applications SET price_cents = price_cents * 100`,
      );
      await client.query(
        `UPDATE bundles SET flat_price_cents = flat_price_cents * 100 WHERE flat_price_cents IS NOT NULL`,
      );
      await client.query(
        `UPDATE writer_earnings
           SET available_cents = available_cents * 100,
               pending_cents = pending_cents * 100,
               total_earned_cents = total_earned_cents * 100`,
      );
      await client.query(`UPDATE payouts SET amount_cents = amount_cents * 100`);
      await client.query(
        `UPDATE referrals SET bonus_cents = bonus_cents * 100 WHERE bonus_cents IS NOT NULL`,
      );
      await client.query(
        `INSERT INTO _migration_markers (name) VALUES ('rescale_cents_x100')`,
      );
    } else {
      console.log("SKIP rescale — marker present (already applied)");
    }

    await client.query("COMMIT");
    console.log("✓ Migration complete");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolled back:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
