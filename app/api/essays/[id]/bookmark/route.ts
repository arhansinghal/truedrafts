import { auth } from "@/lib/auth";
import { db, bookmarks } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, session.user.id), eq(bookmarks.essayId, id)),
  });

  if (existing) {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, session.user.id), eq(bookmarks.essayId, id)));
    return Response.json({ bookmarked: false });
  }

  await db.insert(bookmarks).values({ userId: session.user.id, essayId: id });
  return Response.json({ bookmarked: true });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ bookmarked: false });

  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.userId, session.user.id), eq(bookmarks.essayId, id)),
  });

  return Response.json({ bookmarked: !!existing });
}
