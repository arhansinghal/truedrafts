import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      username: true,
      createdAt: true,
      verifiedAdmit: true,
    },
    orderBy: [desc(users.createdAt)],
  });

  return Response.json(rows);
}
