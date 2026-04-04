import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, asc, desc, or } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending";

  const where =
    status === "all"
      ? or(
          eq(collegeApplications.status, "pending"),
          eq(collegeApplications.status, "approved"),
          eq(collegeApplications.status, "rejected")
        )
      : eq(collegeApplications.status, status as never);

  const rows = await db.query.collegeApplications.findMany({
    where,
    with: {
      university: true,
      writer: { columns: { id: true, name: true, email: true } },
    },
    orderBy:
      status === "pending"
        ? [asc(collegeApplications.createdAt)]
        : [desc(collegeApplications.createdAt)],
    limit: 50,
  });

  return Response.json(rows);
}
