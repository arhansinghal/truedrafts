import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, studioEssays } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { appId, title, prompt, wordCap } = body as {
    appId?: string;
    title?: string;
    prompt?: string;
    wordCap?: number;
  };

  if (!appId || !title?.trim()) {
    return Response.json({ error: "appId and title required" }, { status: 400 });
  }

  // Confirm caller owns the parent app.
  const app = await db.query.studioApps.findFirst({
    where: and(eq(studioApps.id, appId), eq(studioApps.userId, session.user.id)),
  });
  if (!app) return Response.json({ error: "App not found" }, { status: 404 });

  const [essay] = await db
    .insert(studioEssays)
    .values({
      appId,
      title: title.trim(),
      prompt: prompt?.trim() || null,
      wordCap: typeof wordCap === "number" && wordCap > 0 ? wordCap : null,
    })
    .returning();

  return Response.json(essay, { status: 201 });
}
