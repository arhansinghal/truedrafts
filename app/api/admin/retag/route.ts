import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { tagEssay, buildVibeSearchText } from "@/lib/gemma";

/**
 * POST /api/admin/retag
 * Tags all approved applications that are missing vibeSearchText.
 * Processes sequentially to avoid rate limits.
 * Returns a summary of tagged / failed counts.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const untagged = await db.query.collegeApplications.findMany({
    where: (t, { and, eq, isNull }) =>
      and(eq(t.status, "approved"), isNull(t.vibeSearchText)),
  });

  let tagged = 0;
  let failed = 0;

  for (const app of untagged) {
    const essayText = [
      app.commonAppContent ?? "",
      ...(() => {
        try {
          return JSON.parse(app.supplementals ?? "[]").map(
            (s: { content?: string }) => s.content ?? ""
          );
        } catch {
          return [];
        }
      })(),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!essayText) { failed++; continue; }

    const meta = await tagEssay(essayText);
    if (!meta) { failed++; continue; }

    await db
      .update(collegeApplications)
      .set({
        vibeMetadata: JSON.stringify(meta),
        vibeTone: meta.tone,
        vibeSearchText: buildVibeSearchText(meta),
      })
      .where(eq(collegeApplications.id, app.id));

    tagged++;
  }

  return Response.json({ tagged, failed, total: untagged.length });
}
