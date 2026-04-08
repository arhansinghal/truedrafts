import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { tagEssay, buildVibeSearchText } from "@/lib/gemma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : null;

  if (priceCents === null || priceCents < 0) {
    return Response.json({ error: "Valid price required" }, { status: 400 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: { university: true },
  });

  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(collegeApplications)
    .set({
      status: "approved",
      priceCents,
      publishedAt: new Date(),
    })
    .where(eq(collegeApplications.id, id));

  // Tag the essay asynchronously — doesn't block the approval response
  const essayText = [
    app.commonAppContent ?? "",
    ...(() => { try { return JSON.parse(app.supplementals ?? "[]").map((s: {content?: string}) => s.content ?? ""); } catch { return []; } })(),
  ].filter(Boolean).join("\n\n");

  if (essayText) {
    tagEssay(essayText).then(async (meta) => {
      if (!meta) return;
      await db.update(collegeApplications).set({
        vibeMetadata: JSON.stringify(meta),
        vibeTone: meta.tone,
        vibeSearchText: buildVibeSearchText(meta),
      }).where(eq(collegeApplications.id, id));
    }).catch(console.error);
  }

  return Response.json({ ok: true });
}
