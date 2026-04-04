import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
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

  const body = await req.json().catch(() => ({}));
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : null;

  if (priceCents === null || priceCents < 0) {
    return Response.json({ error: "Valid price required" }, { status: 400 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: { university: true },
  });

  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(collegeApplications)
    .set({
      status: "approved",
      priceCents,
      publishedAt: new Date(),
    })
    .where(eq(collegeApplications.id, id));

  return Response.json({ ok: true });
}
