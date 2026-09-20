/**
 * One-off: create the promo_codes and promo_redemptions tables.
 *
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-promo-codes.ts
 *
 * Everything is guarded, so it is safe to run repeatedly.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function ensureEnum(name: string, values: string[]) {
  const literals = values.map((v) => `'${v}'`).join(", ");
  await sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
        CREATE TYPE ${name} AS ENUM (${literals});
      END IF;
    END
    $$
  `);
  console.log(`  ✓ ${name} enum ensured`);
}

async function main() {
  await ensureEnum("promo_kind", ["percent", "flat"]);
  await ensureEnum("promo_scope", ["all", "applications", "essays", "bundles"]);
  await ensureEnum("promo_redemption_status", ["reserved", "applied", "void"]);

  await sql`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      description text,
      kind promo_kind NOT NULL,
      percent_off integer,
      flat_off_cents integer,
      max_discount_cents integer,
      min_subtotal_cents integer NOT NULL DEFAULT 0,
      scope promo_scope NOT NULL DEFAULT 'all',
      max_redemptions integer,
      max_redemptions_per_user integer NOT NULL DEFAULT 1,
      times_redeemed integer NOT NULL DEFAULT 0,
      starts_at timestamp,
      ends_at timestamp,
      active boolean NOT NULL DEFAULT true,
      created_by text REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ promo_codes table ensured");

  await sql`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      promo_code_id uuid NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      buyer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      razorpay_order_id text NOT NULL UNIQUE,
      subtotal_cents integer NOT NULL,
      discount_cents integer NOT NULL,
      charged_cents integer NOT NULL,
      terms_snapshot text NOT NULL,
      listing_kind text NOT NULL,
      listing_id uuid,
      status promo_redemption_status NOT NULL DEFAULT 'reserved',
      created_at timestamp NOT NULL DEFAULT now(),
      applied_at timestamp
    )
  `;
  console.log("  ✓ promo_redemptions table ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_promo_codes_active
    ON promo_codes (active, ends_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code
    ON promo_redemptions (promo_code_id, status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_promo_redemptions_buyer
    ON promo_redemptions (buyer_id, promo_code_id)
  `;
  console.log("  ✓ indexes ensured");

  console.log("\npromo codes ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
