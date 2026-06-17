import { auth } from "@/lib/auth";
import { db, ratings, purchases, essays } from "@/lib/db";
import { eq, and, avg, count, sql } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const score = Number(body.score);
  // Reject NaN / non-integer / out-of-range. Number("x") is NaN and every
  // comparison with NaN is false, so a bare `< 1 || > 5` would let NaN (and
  // fractional scores like 4.999) through and poison avgRating.
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return Response.json({ error: "Score must be an integer 1-5" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;

  // Verify the user purchased this essay
  const purchase = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, session.user.id),
      eq(purchases.essayId, id),
      eq(purchases.status, "completed")
    ),
  });
  if (!purchase) {
    return Response.json({ error: "Purchase required to rate" }, { status: 403 });
  }

  // Upsert rating
  await db
    .insert(ratings)
    .values({ buyerId: session.user.id, essayId: id, score, note })
    .onConflictDoUpdate({
      target: [ratings.buyerId, ratings.essayId],
      set: { score, note },
    })
    .catch(() =>
      db.insert(ratings).values({ buyerId: session.user.id, essayId: id, score, note })
    );

  // Recalculate avg rating on essay
  const result = await db
    .select({ avg: avg(ratings.score), cnt: count(ratings.id) })
    .from(ratings)
    .where(eq(ratings.essayId, id));

  const newAvg = Math.round(Number(result[0].avg ?? 0) * 10);
  const newCount = Number(result[0].cnt ?? 0);

  await db
    .update(essays)
    .set({ avgRating: newAvg, ratingCount: newCount })
    .where(eq(essays.id, id));

  return Response.json({ ok: true });
}
