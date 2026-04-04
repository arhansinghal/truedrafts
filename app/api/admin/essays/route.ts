import { auth } from "@/lib/auth";
import { db, essays } from "@/lib/db";
import { eq, desc, asc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = (url.searchParams.get("status") ?? "pending") as
    | "pending"
    | "approved"
    | "rejected"
    | "archived";

  const rows = await db.query.essays.findMany({
    where: eq(essays.status, status),
    with: {
      writer: { columns: { id: true, name: true, email: true } },
      university: true,
    },
    orderBy: status === "pending" ? [asc(essays.createdAt)] : [desc(essays.createdAt)],
  });

  return Response.json(rows);
}
