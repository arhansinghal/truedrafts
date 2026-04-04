import { db, essays } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db
    .update(essays)
    .set({ previewOpens: sql`${essays.previewOpens} + 1` })
    .where(eq(essays.id, id))
    .catch(() => {});

  return Response.json({ ok: true });
}
