import { auth } from "@/lib/auth";
import { db, writerEarnings } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const earnings = await db.query.writerEarnings.findFirst({
    where: eq(writerEarnings.writerId, session.user.id),
  });

  return Response.json(
    earnings ?? { availableCents: 0, pendingCents: 0, totalEarnedCents: 0 }
  );
}
