/**
 * Run with: npm run db:indexes
 *
 * Creates the GIN full-text search index on college_applications.
 * Safe to run multiple times (uses IF NOT EXISTS).
 *
 * Why a separate script?
 * drizzle-kit push handles column changes but may not reliably create
 * expression-based GIN indexes. Run this once after `npm run db:push`.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  console.log("Applying search indexes...");

  // GIN index for full-text search on college_applications
  // Expression must exactly match to_tsvector() call in applications/page.tsx
  await sql`
    CREATE INDEX IF NOT EXISTS idx_college_apps_fts
    ON college_applications
    USING GIN (
      to_tsvector('english',
        coalesce(vibe_search_text, '') || ' ' ||
        coalesce(title, '') || ' ' ||
        coalesce(major, '')
      )
    )
  `;
  console.log("  ✓ idx_college_apps_fts (GIN, FTS on vibe_search_text + title + major)");

  // GIN index for alias array lookups on universities
  await sql`
    CREATE INDEX IF NOT EXISTS idx_universities_aliases
    ON universities
    USING GIN (aliases)
  `;
  console.log("  ✓ idx_universities_aliases (GIN, array on aliases)");

  // B-tree indexes for structured filters
  await sql`
    CREATE INDEX IF NOT EXISTS idx_universities_state
    ON universities (state)
  `;
  console.log("  ✓ idx_universities_state");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_universities_region
    ON universities (region)
  `;
  console.log("  ✓ idx_universities_region");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_universities_type
    ON universities (type)
  `;
  console.log("  ✓ idx_universities_type");

  console.log("\nAll search indexes applied.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
