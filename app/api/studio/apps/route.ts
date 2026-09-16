import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps, studioEssays, universities } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const apps = await db.query.studioApps.findMany({
    where: eq(studioApps.userId, session.user.id),
    with: {
      university: true,
      essays: {
        columns: { id: true, title: true, wordCount: true, status: true, updatedAt: true },
      },
    },
    orderBy: [desc(studioApps.updatedAt)],
  });

  return Response.json(apps);
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { universityId, title } = body as { universityId?: string; title?: string };

  if (!universityId) {
    return Response.json({ error: "universityId required" }, { status: 400 });
  }

  const uni = await db.query.universities.findFirst({
    where: eq(universities.id, universityId),
  });
  if (!uni) return Response.json({ error: "University not found" }, { status: 404 });

  const [app] = await db
    .insert(studioApps)
    .values({
      userId: session.user.id,
      universityId,
      title: title?.trim() || `${uni.name} Application`,
    })
    .returning();

  // Seed a Common App essay so the workspace isn't empty on first open.
  try {
    await db.insert(studioEssays).values({
      appId: app.id,
      title: "Common App Essay",
      prompt: null,
      wordCap: 650,
    });
  } catch (err) {
    // Compensate: remove the application so we never persist an essay-less workspace.
    await db.delete(studioApps).where(eq(studioApps.id, app.id));
    throw err;
  }

  return Response.json(app, { status: 201 });
}
