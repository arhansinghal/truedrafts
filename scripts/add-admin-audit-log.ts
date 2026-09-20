/**
 * Create the admin_audit_log table, and optionally prune it.
 *
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-admin-audit-log.ts
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-admin-audit-log.ts --prune
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/add-admin-audit-log.ts --prune --dry
 *
 * `--prune` deletes entries older than the retention window. Run it on a
 * schedule once the log has been live for a while; it is the only thing that
 * ever removes a row.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

/** How long an audit entry is kept. Two years covers a full admissions cycle
 *  plus the year anyone would plausibly ask about it. */
const RETENTION_DAYS = 730;

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id text REFERENCES users(id) ON DELETE SET NULL,
      actor_email text NOT NULL,
      action text NOT NULL,
      target_type text NOT NULL,
      target_id text,
      target_label text,
      before_json text,
      after_json text,
      ip_address text,
      user_agent text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  console.log("  ✓ admin_audit_log table ensured");

  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created
    ON admin_audit_log (created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
    ON admin_audit_log (actor_id, created_at)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_target
    ON admin_audit_log (target_type, target_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_action
    ON admin_audit_log (action, created_at)
  `;
  console.log("  ✓ indexes ensured");
}

async function prune(dryRun: boolean) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const [{ count }] = (await sql`
    SELECT count(*)::int AS count
    FROM admin_audit_log
    WHERE created_at < ${cutoff.toISOString()}
  `) as { count: number }[];

  if (dryRun) {
    console.log(
      `  would delete ${count} entries older than ${cutoff.toISOString().slice(0, 10)}`,
    );
    return;
  }

  if (count === 0) {
    console.log("  nothing to prune");
    return;
  }

  await sql`
    DELETE FROM admin_audit_log
    WHERE created_at < ${cutoff.toISOString()}
  `;
  console.log(
    `  ✓ pruned ${count} entries older than ${cutoff.toISOString().slice(0, 10)}`,
  );
}

async function main() {
  const shouldPrune = process.argv.includes("--prune");
  const dryRun = process.argv.includes("--dry");

  if (shouldPrune) {
    await prune(dryRun);
    return;
  }

  await ensureTable();
  console.log("\nadmin audit log ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
