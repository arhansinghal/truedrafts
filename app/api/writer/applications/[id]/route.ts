import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// DELETE /api/writer/applications/[id] — "delete" a submitted application.
// This is a soft-delete: we set status to "archived" so the application drops
// out of Browse, bundles, AI search and the writer's own list, while existing
// buyers keep access (their access is keyed on the purchase record, not on the
// application's status — see app/(marketing)/applications/[slug]/page.tsx).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [updated] = await db
    .update(collegeApplications)
    .set({ status: "archived" })
    .where(
      and(
        eq(collegeApplications.id, id),
        eq(collegeApplications.writerId, session.user.id),
      )
    )
    .returning({ id: collegeApplications.id });

  if (!updated) return Response.json({ error: "Application not found" }, { status: 404 });

  return new Response(null, { status: 204 });
}
