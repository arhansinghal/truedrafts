import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";

// Bare /studio/[appId] redirects to the first essay so the URL always names
// the active essay. Avoids stale "which essay was open" client state.
export default async function StudioAppRedirect({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/studio");

  const { appId } = await params;
  const app = await db.query.studioApps.findFirst({
    where: and(eq(studioApps.id, appId), eq(studioApps.userId, session.user.id)),
    with: { essays: { orderBy: (e) => [asc(e.createdAt)] } },
  });
  if (!app) notFound();

  const first = app.essays[0];
  if (!first) {
    // No essays yet — shouldn't happen since create seeds one, but be safe.
    redirect("/studio");
  }

  redirect(`/studio/${appId}/${first.id}`);
}
