/**
 * One-off: create the highlights table.
 *
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-highlights.ts
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
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'highlight_color') THEN
        CREATE TYPE highlight_color AS ENUM ('yellow', 'blue', 'green', 'pink');
      END IF;
    END
    $$
  `;
  console.log("  ✓ highlight_color enum ensured");

  await sql`
    CREATE TABLE IF NOT EXISTS highlights (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id uuid NOT NULL REFERENCES college_applications(id) ON DELETE CASCADE,
      essay_index integer NOT NULL,
      para_index integer NOT NULL,
      start_offset integer NOT NULL,
      end_offset integer NOT NULL,
      quote text NOT NULL,
      note text,
      color highlight_color NOT NULL DEFAULT 'yellow',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ highlights table ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_highlights_user_application
    ON highlights (user_id, application_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_highlights_user_time
    ON highlights (user_id, created_at)
  `;
  console.log("  ✓ indexes ensured");

  console.log("\nhighlights ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
