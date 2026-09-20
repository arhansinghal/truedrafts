import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendApplicationRejectedEmail } from "@/lib/email";
import { recordAdminAction, AUDIT_ACTIONS } from "@/lib/audit/record";

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

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
  });
  if (!app) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(collegeApplications)
    .set({ status: "rejected", rejectionNote: reason })
    .where(eq(collegeApplications.id, id));

  await recordAdminAction({
    req,
    actor: { id: session.user.id, email: session.user.email },
    action: AUDIT_ACTIONS.applicationReject,
    targetType: "college_application",
    targetId: id,
    targetLabel: app.title,
    before: { status: app.status, rejectionNote: app.rejectionNote },
    after: { status: "rejected", rejectionNote: reason },
  });

  sendApplicationRejectedEmail(app.writerId, id, reason).catch(console.error);

  return Response.json({ ok: true });
}
