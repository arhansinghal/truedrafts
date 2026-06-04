import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications } from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { generateInsightBrief } from "../lib/vibe-anthropic";

/** True if the stored brief matches the new schema (has common_app.summary). */
function isNewSchema(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return !!parsed?.common_app?.summary;
  } catch {
    return false;
  }
}

async function main() {
  const apps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.status, "approved"),
  });

  const todo = apps.filter((a) => !isNewSchema(a.insightBrief));
  console.log(`Generating insight briefs: ${todo.length} / ${apps.length} apps need one`);

  let done = 0;
  let failed = 0;
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const app of todo) {
    const supplementals: Array<{ prompt?: string; content?: string }> = (() => {
      try { return JSON.parse(app.supplementals ?? "[]"); }
      catch { return []; }
    })();

    const brief = await generateInsightBrief({
      commonAppContent: app.commonAppContent,
      commonAppPrompt: app.commonAppPrompt,
      submittedCommonApp: !!app.submittedCommonApp,
      supplementals,
      major: app.major,
    });

    if (!brief) {
      console.log(`  fail ${app.id.slice(0, 8)}… ${app.title.slice(0, 50)}`);
      failed++;
      await delay(800);
      continue;
    }

    await db
      .update(collegeApplications)
      .set({ insightBrief: JSON.stringify(brief) })
      .where(eq(collegeApplications.id, app.id));

    done++;
    console.log(
      `  ok   ${app.id.slice(0, 8)}… ${app.title.slice(0, 50)} · ${brief.num_supplementals} supp · topics=${(brief.common_app.topics ?? []).slice(0, 3).join(",")}`
    );
    await delay(600);
  }

  console.log(`\nDone. ok=${done} failed=${failed} total=${todo.length}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
