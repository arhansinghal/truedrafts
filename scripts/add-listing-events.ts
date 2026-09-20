/**
 * One-off: create the listing_events table behind the writer analytics
 * dashboard.
 *
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-listing-events.ts
 *
 * Why a script rather than `npm run db:push`: drizzle-kit push is reliable for
 * column changes, but this needs a new enum type plus three indexes, and doing
 * it explicitly here keeps the ordering obvious. Everything is IF NOT EXISTS,
 * so it is safe to run repeatedly.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Postgres has no CREATE TYPE IF NOT EXISTS, so guard it explicitly.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'listing_event_kind') THEN
        CREATE TYPE listing_event_kind AS ENUM ('view', 'preview_open');
      END IF;
    END
    $$
  `;
  console.log("  ✓ listing_event_kind enum ensured");

  await sql`
    CREATE TABLE IF NOT EXISTS listing_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      writer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      essay_id uuid REFERENCES essays(id) ON DELETE CASCADE,
      application_id uuid REFERENCES college_applications(id) ON DELETE CASCADE,
      kind listing_event_kind NOT NULL,
      occurred_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ listing_events table ensured");

  // The dashboard's hot path: one writer, one time window, grouped by day.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_listing_events_writer_time
    ON listing_events (writer_id, occurred_at)
  `;
  console.log("  ✓ idx_listing_events_writer_time");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_listing_events_essay
    ON listing_events (essay_id)
  `;
  console.log("  ✓ idx_listing_events_essay");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_listing_events_application
    ON listing_events (application_id)
  `;
  console.log("  ✓ idx_listing_events_application");

  console.log("\nlisting_events ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
