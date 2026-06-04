import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications, universities } from "../lib/db/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  const penn = await db.query.universities.findFirst({ where: eq(universities.slug, "upenn") });
  console.log("Penn university:", penn?.id, penn?.name);
  if (!penn) return;
  const allPenn = await db
    .select({
      id: collegeApplications.id,
      status: collegeApplications.status,
      hasBrief: collegeApplications.insightBrief,
      hasEmb: collegeApplications.insightBriefEmbedding,
    })
    .from(collegeApplications)
    .where(eq(collegeApplications.universityId, penn.id));
  console.log(`Total Penn apps: ${allPenn.length}`);
  console.log(`  approved: ${allPenn.filter((a) => a.status === "approved").length}`);
  console.log(`  with insightBrief (>20 chars): ${allPenn.filter((a) => a.hasBrief && a.hasBrief.length > 20).length}`);
  const approved = allPenn.filter((a) => a.status === "approved");
  console.log(`  approved & w/ embedding: ${approved.filter((a) => a.hasEmb).length} of ${approved.length}`);
  console.log(`  approved & w/ brief but NO embedding: ${approved.filter((a) => a.hasBrief && a.hasBrief.length > 20 && !a.hasEmb).length}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
