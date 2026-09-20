import { db, essays } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { recordListingEvent } from "@/lib/analytics/query";
import { shouldCountView } from "@/lib/analytics/view-throttle";

/**
 * View beacon for a standalone essay.
 *
 * Bumps the lifetime counter on the listing (what the marketing pages sort by)
 * *and* appends a timestamped row to `listing_events` so the writer analytics
 * dashboard can scope views to a window. Both writes are best-effort.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!shouldCountView(req, id)) {
    return Response.json({ ok: true, skipped: true });
  }

  const essay = await db.query.essays
    .findFirst({
      where: eq(essays.id, id),
      columns: { id: true, writerId: true },
    })
    .catch(() => undefined);

  if (!essay) return Response.json({ ok: true, skipped: true });

  await db
    .update(essays)
    .set({ views: sql`${essays.views} + 1` })
    .where(eq(essays.id, id))
    .catch(() => {});

  await recordListingEvent({
    writerId: essay.writerId,
    essayId: essay.id,
    kind: "view",
  });

  return Response.json({ ok: true });
}
