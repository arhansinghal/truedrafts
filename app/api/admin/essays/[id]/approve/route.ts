import { auth } from "@/lib/auth";
import { db, essays, universities } from "@/lib/db";
import { sendEssayApproved } from "@/lib/resend";
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

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { university: true },
  });

  if (!essay) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(essays)
    .set({
      status: "approved",
      publishedAt: new Date(),
    })
    .where(eq(essays.id, id));

  sendEssayApproved(essay.writerId, id).catch(console.error);

  return Response.json({ ok: true });
}
