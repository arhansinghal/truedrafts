import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const apps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.status, "approved"),
    with: { university: { columns: { slug: true } } },
  });

  for (const a of apps) {
    const meta = (() => {
      try { return JSON.parse(a.vibeMetadata ?? "{}"); }
      catch { return null; }
    })();
    const uni = a.university?.slug ?? "?";
    console.log(`\n── ${uni.padEnd(13)} ${a.title.slice(0, 60)}`);
    console.log(`   major:      ${a.major ?? "-"}`);
    console.log(`   tone:       ${a.vibeTone ?? "-"}`);
    if (meta) {
      console.log(`   arc:        ${meta.narrative_arc ?? "-"}`);
      console.log(`   summary:    ${meta.vibe_summary ?? "-"}`);
      console.log(`   values:     ${(meta.core_values ?? []).join(", ")}`);
      console.log(`   themes:     ${(meta.themes ?? []).join(", ")}`);
      console.log(`   activities: ${(meta.activities ?? []).join(", ")}`);
    }
    console.log(`   searchText: ${(a.vibeSearchText ?? "").slice(0, 120)}${(a.vibeSearchText ?? "").length > 120 ? "…" : ""}`);
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
