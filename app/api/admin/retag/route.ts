import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { tagApplicationEssays, buildVibeSearchText } from "@/lib/vibe-anthropic";

/**
 * POST /api/admin/retag
 * Re-tags approved applications that are missing vibeSearchText or major.
 * Pass { force: true } in the request body to retag ALL approved applications,
 * which is useful after upgrading the tagging prompt's activity vocabulary.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const force = body.force === true;

  const apps = force
    ? await db.query.collegeApplications.findMany({
        where: eq(collegeApplications.status, "approved"),
      })
    : await db.query.collegeApplications.findMany({
        where: and(
          eq(collegeApplications.status, "approved"),
          or(
            isNull(collegeApplications.vibeSearchText),
            isNull(collegeApplications.major)
          )
        ),
      });

  let tagged = 0;
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
      failed++;
      continue;
    }

    const meta = await tagApplicationEssays(essayText).catch((e: unknown) => {
      console.error(`retag failed for ${app.id}:`, e instanceof Error ? e.message : e);
      return null;
    });

    if (!meta) {
      failed++;
      await delay(800);
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
    await delay(800);
  }

  return Response.json({ tagged, failed, total: apps.length, forced: force });
}
