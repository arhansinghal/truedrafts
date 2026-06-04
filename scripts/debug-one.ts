import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications } from "../lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";

async function main() {
  const apps = await db.query.collegeApplications.findMany({
    where: and(
      eq(collegeApplications.status, "approved"),
      isNull(collegeApplications.vibeSearchText)
    ),
  });
  console.log(`${apps.length} untagged`);
  const app = apps[0];
  console.log("ID:", app.id, "title:", app.title);
  console.log("commonAppContent length:", app.commonAppContent?.length ?? 0);
  console.log("supplementals:", (app.supplementals ?? "").slice(0, 200));

  const supps: string[] = (() => {
    try { return JSON.parse(app.supplementals ?? "[]").map((s: any) => s.content ?? ""); }
    catch { return []; }
  })();
  const essay = [app.commonAppContent ?? "", ...supps].filter(Boolean).join("\n\n");
  console.log("Full essay length:", essay.length);
  console.log("Essay preview:", essay.slice(0, 300));

  const c = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await c.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `Return JSON with fields tone, core_values, narrative_arc, vibe_summary, themes, major, activities. Essay: ${essay.slice(0, 12000)}`,
    }],
  });
  const block = msg.content[0];
  console.log("Response:", block.type === "text" ? block.text.slice(0, 1500) : block);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
