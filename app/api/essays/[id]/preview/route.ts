import { db, essays } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { recordListingEvent } from "@/lib/analytics/query";

/**
 * Preview-open beacon for a standalone essay.
 *
 * Unlike the view beacon this is not throttled: opening the paywalled preview
 * is a deliberate act, and a reader who opens it three times in an afternoon is
 * genuinely three signals of intent for the writer's funnel.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const essay = await db.query.essays
    .findFirst({
      where: eq(essays.id, id),
      columns: { id: true, writerId: true },
    })
    .catch(() => undefined);

  if (!essay) return Response.json({ ok: true, skipped: true });

  await db
    .update(essays)
    .set({ previewOpens: sql`${essays.previewOpens} + 1` })
    .where(eq(essays.id, id))
    .catch(() => {});

  await recordListingEvent({
    writerId: essay.writerId,
    essayId: essay.id,
    kind: "preview_open",
  });

  return Response.json({ ok: true });
}
