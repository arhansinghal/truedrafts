import { auth } from "@/lib/auth";
import { db, purchases, essays, users } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all essays by this writer first
  const writerEssays = await db.query.essays.findMany({
    where: eq(essays.writerId, session.user.id),
    columns: { id: true, title: true, slug: true },
  });

  const essayIds = writerEssays.map((e) => e.id);
  if (essayIds.length === 0) return Response.json([]);

  // Get all purchases for these essays
  const allPurchases = await db.query.purchases.findMany({
    where: (p, { inArray, eq }) =>
      inArray(p.essayId, essayIds),
    with: { buyer: { columns: { id: true, name: true, email: true } } },
    orderBy: [desc(purchases.purchasedAt)],
  });

  // Attach essay info to each purchase
  const essayMap = Object.fromEntries(writerEssays.map((e) => [e.id, e]));
  const result = allPurchases.map((p) => ({
    ...p,
    essay: p.essayId ? essayMap[p.essayId] : undefined,
  }));

  return Response.json(result);
}
