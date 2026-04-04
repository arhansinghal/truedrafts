import { db, essays } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const essay = await db.query.essays.findFirst({
    where: and(eq(essays.universityId, id), eq(essays.status, "approved")),
    columns: {
      id: true,
      slug: true,
      title: true,
      previewContent: true,
      priceCents: true,
      essayType: true,
    },
    orderBy: (e, { desc }) => [desc(e.purchases)],
  });

  if (!essay) return Response.json(null, { status: 404 });
  return Response.json(essay);
}
