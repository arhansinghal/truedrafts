import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [row] = await db
    .update(bundles)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(bundles.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ bundle: row });
}
