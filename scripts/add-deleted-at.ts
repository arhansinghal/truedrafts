/**
 * One-off: add the users.deleted_at column for admin account deletion.
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-deleted-at.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamp`;
  console.log("✓ users.deleted_at ensured.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
