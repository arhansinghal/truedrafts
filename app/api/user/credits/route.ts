import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userCredits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** The signed-in user's unlock-credit balance. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await db.query.userCredits.findFirst({
    where: eq(userCredits.userId, session.user.id),
  });

  return Response.json({ balance: row?.balance ?? 0 });
}
