import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { tagEssay, buildVibeSearchText, getEssayHighlight } from "@/lib/gemma";
import { sendApplicationApprovedEmail } from "@/lib/email";

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
    Promise.all([
      tagEssay(essayText),
      getEssayHighlight(essayText),
      // Generate AI Insight Brief via Python service (if configured)
      process.env.AI_SERVICE_URL
        ? fetch(`${process.env.AI_SERVICE_URL}/brief`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ application_id: id, essay_text: essayText }),
            signal: AbortSignal.timeout(10000),
          }).then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
    ]).then(async ([meta, highlight, briefResult]) => {
      const updates: Record<string, unknown> = {};
      if (meta) {
        updates.vibeMetadata   = JSON.stringify(meta);
        updates.vibeTone       = meta.tone;
        updates.vibeSearchText = buildVibeSearchText(meta);
      }
      // briefResult.brief is already saved to DB by the Python service,
      // but we store it here too for resilience
      if (briefResult?.brief && !briefResult?.cached) {
        updates.insightBrief = JSON.stringify(briefResult.brief);
      }
      if (Object.keys(updates).length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.update(collegeApplications).set(updates as any).where(eq(collegeApplications.id, id));
      }
      await sendApplicationApprovedEmail(app.writerId, id, highlight);
    }).catch(console.error);
  } else {
    sendApplicationApprovedEmail(app.writerId, id).catch(console.error);
  }

  return Response.json({ ok: true });
}
