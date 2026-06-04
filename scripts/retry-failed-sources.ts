// Retry all studio_sources with status='failed' — useful after a config fix
// (e.g. embedding-dim mismatch). Idempotent; sources that succeeded stay.

import { db } from "../lib/db";
import { studioSources } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { ingestUrlSource } from "../lib/studio/ingest";

async function main() {
  const failed = await db
    .select()
    .from(studioSources)
    .where(eq(studioSources.status, "failed"));
  console.log(`retrying ${failed.length} failed sources`);
  for (const s of failed) {
    if (s.kind !== "url") {
      console.log(`  skip ${s.id} (${s.kind})`);
      continue;
    }
    console.log(`  retry ${s.uri}`);
    const r = await ingestUrlSource(s);
    console.log(`    → ${r.status} (${r.chunksInserted} chunks${r.errorMessage ? `, ${r.errorMessage.slice(0, 80)}` : ""})`);
    await new Promise((ok) => setTimeout(ok, 22_000));
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
