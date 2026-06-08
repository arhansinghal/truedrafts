import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: {
      university: true,
      writer: { columns: { id: true, name: true, email: true } },
    },
  });

  if (!app) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(app);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const allowed = [
    "title",
    "admittedYear",
    "commonAppPrompt",
    "commonAppContent",
    "commonAppScreenshotUrl",
    "admissionProofUrl",
    "supplementals",
    "tags",
    "major",
    "priceCents",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "supplementals") {
        updates[key] = typeof body[key] === "string" ? body[key] : JSON.stringify(body[key]);
      } else if (key === "tags") {
        updates[key] = Array.isArray(body[key]) ? body[key] : [];
      } else {
        updates[key] = body[key];
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(collegeApplications).set(updates).where(eq(collegeApplications.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.delete(purchases).where(eq(purchases.applicationId, id));
  await db.delete(collegeApplications).where(eq(collegeApplications.id, id));
  return Response.json({ ok: true });
}
