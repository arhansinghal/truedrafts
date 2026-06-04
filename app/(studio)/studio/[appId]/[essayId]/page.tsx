import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { studioApps } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";

export default async function StudioWorkspacePage({
  params,
}: {
  params: Promise<{ appId: string; essayId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?redirect=/studio");

  const { appId, essayId } = await params;
  const app = await db.query.studioApps.findFirst({
    where: and(eq(studioApps.id, appId), eq(studioApps.userId, session.user.id)),
    with: {
      university: true,
      essays: { orderBy: (e) => [asc(e.createdAt)] },
    },
  });
  if (!app) notFound();

  const essay = app.essays.find((e) => e.id === essayId);
  if (!essay) notFound();

  return (
    <div className="h-[calc(100vh-4rem)]">
      <StudioWorkspace
        app={{
          id: app.id,
          title: app.title,
          university: { name: app.university.name, slug: app.university.slug },
        }}
        essays={app.essays.map((e) => ({
          id: e.id,
          title: e.title,
          wordCount: e.wordCount,
          wordCap: e.wordCap,
          status: e.status,
        }))}
        activeEssayId={essay.id}
        activeEssay={{
          id: essay.id,
          title: essay.title,
          prompt: essay.prompt,
          wordCap: essay.wordCap,
          content: essay.content,
          contentText: essay.contentText,
          wordCount: essay.wordCount,
          status: essay.status,
        }}
      />
    </div>
  );
}
