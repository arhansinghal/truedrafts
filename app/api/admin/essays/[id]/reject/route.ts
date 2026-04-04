import { auth } from "@/lib/auth";
import { db, essays } from "@/lib/db";
import { sendEssayRejected } from "@/lib/resend";
import { eq } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reason } = await req.json();
  if (!reason) {
    return Response.json({ error: "Rejection reason required" }, { status: 400 });
  }

  const essay = await db.query.essays.findFirst({ where: eq(essays.id, id) });
  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(essays)
    .set({ status: "rejected", rejectionNote: reason })
    .where(eq(essays.id, id));

  sendEssayRejected(essay.writerId, id, reason).catch(console.error);

  return Response.json({ ok: true });
}
