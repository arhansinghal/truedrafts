import { auth } from "@/lib/auth";
import { db, users, sessions, accounts, collegeApplications } from "@/lib/db";
import { eq, and, isNull, sql } from "drizzle-orm";

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
  const allowed = ["role", "verifiedAdmit"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, id));
  return Response.json({ ok: true });
}

// "Delete" an account. We do NOT hard-delete the row: purchases, sales,
// earnings and payout records reference this user and other people depend on
// them (buyers must keep access to essays they paid for). Instead we:
//   1. revoke login (drop sessions + accounts),
//   2. archive every listing the user published (drops from Browse/search,
//      but past buyers keep access — see applications/[slug] access gate),
//   3. scrub all PII so the user is no longer identifiable anywhere, and
//   4. stamp deletedAt so the account disappears from the admin user list.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: an admin can't delete their own account.
  if (id === session.user.id) {
    return Response.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: { id: true, role: true, deletedAt: true },
  });
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.deletedAt) return Response.json({ ok: true, alreadyDeleted: true });

  // Guard: never remove the last remaining admin.
  if (target.role === "admin") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.deletedAt)));
    if (count <= 1) {
      return Response.json({ error: "Can't delete the last remaining admin." }, { status: 400 });
    }
  }

  await db.transaction(async (tx) => {
    // 1. Revoke login.
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await tx.delete(accounts).where(eq(accounts.userId, id));

    // 2. De-list their published applications (buyers keep access).
    //    NOTE: standalone `essays` are intentionally NOT archived here. The
    //    essays detail page filters status="approved" in its query (unlike the
    //    applications page, which carves out archived-for-purchasers), so
    //    archiving an essay would lock out past buyers. The essays table is
    //    currently empty (feature dormant). If standalone essays are revived,
    //    archive them here AND add the purchaser carve-out to essays/[slug].
    await tx
      .update(collegeApplications)
      .set({ status: "archived" })
      .where(eq(collegeApplications.writerId, id));

    // 3 + 4. Scrub PII, demote, and tombstone the account.
    await tx
      .update(users)
      .set({
        name: "Deleted user",
        email: `deleted+${id}@deleted.invalid`,
        username: null,
        bio: null,
        profilePhoto: null,
        image: null,
        country: null,
        activities: "[]",
        referralCode: null,
        verifiedAdmit: false,
        extracurriculars: null,
        gpa: null,
        satScore: null,
        actScore: null,
        graduationYear: null,
        role: "reader",
        deletedAt: new Date(),
      })
      .where(eq(users.id, id));
  });

  return Response.json({ ok: true });
}
