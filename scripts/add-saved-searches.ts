/**
 * One-off: create the saved_searches table.
 *
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-saved-searches.ts
 *
 * Safe to run repeatedly.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saved_search_cadence') THEN
        CREATE TYPE saved_search_cadence AS ENUM ('off', 'daily', 'weekly');
      END IF;
    END
    $$
  `;
  console.log("  ✓ saved_search_cadence enum ensured");

  await sql`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      filters text NOT NULL DEFAULT '{}',
      cadence saved_search_cadence NOT NULL DEFAULT 'weekly',
      last_notified_at timestamp,
      matches_sent integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ saved_searches table ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_saved_searches_user
    ON saved_searches (user_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_saved_searches_due
    ON saved_searches (cadence, last_notified_at)
  `;
  console.log("  ✓ indexes ensured");

  // The digest's per-search window filters on published_at; without this the
  // scan is a seq scan over every approved application, once per saved search.
  await sql`
    CREATE INDEX IF NOT EXISTS idx_college_apps_status_published
    ON college_applications (status, published_at)
  `;
  console.log("  ✓ idx_college_apps_status_published");

  console.log("\nsaved searches ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
