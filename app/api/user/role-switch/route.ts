import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { generateReferralCode } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { targetRole } = await req.json();
  if (targetRole !== "writer") return Response.json({ error: "Invalid role" }, { status: 400 });
  if (session.user.role === "writer") return Response.json({ ok: true }); // already writer

  await db.update(users)
    .set({ role: "writer", referralCode: generateReferralCode() })
    .where(eq(users.id, session.user.id));

  return Response.json({ ok: true });
}
