import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

async function loadOwned(appId: string, userId: string) {
  return db.query.studioApps.findFirst({
    where: and(eq(studioApps.id, appId), eq(studioApps.userId, userId)),
    with: {
      university: true,
      essays: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
    },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const app = await loadOwned(id, session.user.id);
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(app);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { title } = body as { title?: string };

  const [updated] = await db
    .update(studioApps)
    .set({
      ...(title !== undefined ? { title: title.trim() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(studioApps.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });

  await db.delete(studioApps).where(eq(studioApps.id, id));
  return Response.json({ ok: true });
}
