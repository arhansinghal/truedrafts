import { db } from "../lib/db";
import { studioSources } from "../lib/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: studioSources.id,
      status: studioSources.status,
      kind: studioSources.kind,
      uri: studioSources.uri,
      errorMessage: studioSources.errorMessage,
    })
    .from(studioSources)
    .orderBy(desc(studioSources.createdAt))
    .limit(10);
  console.log(`Recent ${rows.length} studio_sources:`);
  for (const r of rows) {
    console.log(`  ${r.status.padEnd(10)} ${r.kind} ${r.uri.slice(0, 60)}`);
    if (r.errorMessage) console.log(`    error: ${r.errorMessage}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
