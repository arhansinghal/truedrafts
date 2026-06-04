import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, studioSources } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ingestUrlSource } from "@/lib/studio/ingest";

async function loadOwned(sourceId: string, userId: string) {
  const row = await db.query.studioSources.findFirst({
    where: eq(studioSources.id, sourceId),
    with: { app: true },
  });
  if (!row || row.app.userId !== userId) return null;
  return row;
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
  await db.delete(studioSources).where(eq(studioSources.id, id));
  return Response.json({ ok: true });
}

// POST /api/studio/sources/[id] — re-fetch on demand (URL only).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const owned = await loadOwned(id, session.user.id);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
  if (owned.kind !== "url") {
    return Response.json({ error: "Only URL sources support refetch" }, { status: 400 });
  }
  const result = await ingestUrlSource(owned);
  const final = await db.query.studioSources.findFirst({ where: eq(studioSources.id, id) });
  return Response.json({ ...final, _ingest: result });
}
