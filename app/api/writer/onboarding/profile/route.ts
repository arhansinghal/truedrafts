import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

// Saves writer onboarding profile fields. Accepts any subset of
// { name, country, bio, activities } and only updates what's provided, so the
// wizard can save name+country up front and bio+activities at the end.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, country, bio, activities } = body;

  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof country === "string") updates.country = country.trim() || null;
  if (typeof bio === "string") updates.bio = bio.trim() || null;
  if (Array.isArray(activities)) {
    const cleaned = activities
      .filter((a) => a && typeof a.name === "string" && a.name.trim())
      .map((a) => ({ name: String(a.name).trim(), description: String(a.description ?? "").trim() }));
    updates.activities = JSON.stringify(cleaned);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: true });
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
