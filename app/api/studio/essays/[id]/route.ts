import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, studioEssays } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// Joined ownership check: essay → app → user.
async function loadOwned(essayId: string, userId: string) {
  const row = await db.query.studioEssays.findFirst({
    where: eq(studioEssays.id, essayId),
    with: { app: { with: { university: true } } },
  });
  if (!row || row.app.userId !== userId) return null;
  return row;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const essay = await loadOwned(id, session.user.id);
  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(essay);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const essay = await loadOwned(id, session.user.id);
  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { title, prompt, wordCap, content, contentText, status } = body as {
    title?: string;
    prompt?: string | null;
    wordCap?: number | null;
    content?: string;
    contentText?: string;
    status?: "draft" | "in_progress" | "done";
  };

  const patch: Partial<typeof studioEssays.$inferInsert> = { updatedAt: new Date() };
  if (title !== undefined) patch.title = title.trim();
  if (prompt !== undefined) patch.prompt = prompt?.trim() || null;
  if (wordCap !== undefined) patch.wordCap = wordCap && wordCap > 0 ? wordCap : null;
  if (content !== undefined) patch.content = content;
  if (contentText !== undefined) {
    patch.contentText = contentText;
    patch.wordCount = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
  }
  if (status !== undefined) patch.status = status;

  const [updated] = await db
    .update(studioEssays)
    .set(patch)
    .where(eq(studioEssays.id, id))
    .returning();

  // Bump parent app's updatedAt so dashboard sort stays meaningful.
  await db
    .update(studioApps)
    .set({ updatedAt: new Date() })
    .where(eq(studioApps.id, essay.appId));

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const essay = await loadOwned(id, session.user.id);
  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  await db.delete(studioEssays).where(eq(studioEssays.id, id));
  return Response.json({ ok: true });
}
