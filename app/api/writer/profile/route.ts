import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, collegeApplications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user, applications] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.user.id) }),
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, session.user.id),
      with: { university: true },
      orderBy: [desc(collegeApplications.admittedYear)],
    }),
  ]);

  return Response.json({ user, applications });
}
