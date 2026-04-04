import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.bio !== undefined) updates.bio = body.bio?.trim() ?? null;
  if (body.country !== undefined) updates.country = body.country?.trim() ?? null;
  if (body.activities !== undefined) updates.activities = JSON.stringify(body.activities ?? []);

  if (Object.keys(updates).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
