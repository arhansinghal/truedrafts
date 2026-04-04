import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { username, bio } = body;

  if (!username?.trim()) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  // Check username uniqueness
  const existing = await db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true },
  });
  if (existing && existing.id !== session.user.id) {
    return Response.json({ error: "Username already taken" }, { status: 409 });
  }

  await db.update(users).set({ username: username.trim(), bio: bio?.trim() ?? null }).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
