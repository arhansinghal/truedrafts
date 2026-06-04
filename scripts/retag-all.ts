import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications } from "../lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { tagApplicationEssays, buildVibeSearchText } from "../lib/vibe-anthropic";

async function main() {
  const apps = await db.query.collegeApplications.findMany({
    where: and(
      eq(collegeApplications.status, "approved"),
      isNull(collegeApplications.vibeSearchText)
    ),
  });
  console.log(`Tagging ${apps.length} approved apps...`);

  let tagged = 0;
  let skipped = 0;
  let failed = 0;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const app of apps) {
    const supplementalTexts: string[] = (() => {
      try {
        return JSON.parse(app.supplementals ?? "[]").map(
          (s: { content?: string }) => s.content ?? ""
        );
      } catch {
        return [];
      }
    })();

    const essayText = [app.commonAppContent ?? "", ...supplementalTexts]
      .filter(Boolean)
      .join("\n\n");

    if (!essayText) {
      console.log(`  skip ${app.id} (no essay text)`);
      skipped++;
      continue;
    }

    const meta = await tagApplicationEssays(essayText).catch((e: unknown) => {
      console.error(`  fail ${app.id}:`, e instanceof Error ? e.message : e);
      return null;
    });

    if (!meta) {
      failed++;
      await delay(600);
      continue;
    }

    await db
      .update(collegeApplications)
      .set({
        vibeMetadata: JSON.stringify(meta),
        vibeTone: meta.tone,
        vibeSearchText: buildVibeSearchText(meta),
        ...(meta.major ? { major: meta.major } : {}),
      })
      .where(eq(collegeApplications.id, app.id));

    tagged++;
    console.log(
      `  ok   ${app.id.slice(0, 8)}… tone=${meta.tone} major=${meta.major ?? "-"} themes=${(meta.themes ?? []).slice(0, 3).join(",")}`
    );
    await delay(600);
  }

  console.log(`\nDone. tagged=${tagged} skipped=${skipped} failed=${failed} total=${apps.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
