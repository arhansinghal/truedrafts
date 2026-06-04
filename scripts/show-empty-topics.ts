import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const { db } = await import("../lib/db/index.js");
  const { collegeApplications } = await import("../lib/db/schema.js");
  const { eq } = await import("drizzle-orm");

  const apps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.status, "approved"),
    with: { university: { columns: { slug: true, name: true } } },
  });

  const empty: Array<{ id: string; uni: string; title: string; suppCount: number; hasSummary: boolean }> = [];

  for (const a of apps) {
    if (!a.insightBrief) continue;
    try {
      const b = JSON.parse(a.insightBrief);
      const topics = b?.common_app?.topics ?? [];
      if (topics.length === 0) {
        empty.push({
          id: a.id,
          uni: a.university?.name ?? "?",
          title: a.title,
          suppCount: b?.num_supplementals ?? 0,
          hasSummary: !!b?.common_app?.summary,
        });
      }
    } catch {
      // ignore
    }
  }

  console.log(`\n${empty.length} apps with empty topics arrays:\n`);
  for (const e of empty) {
    console.log(`  ${e.id.slice(0, 8)}  ${e.uni}`);
    console.log(`            ${e.title.slice(0, 70)}`);
    console.log(`            summary=${e.hasSummary ? "yes" : "NO"}  supp=${e.suppCount}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
