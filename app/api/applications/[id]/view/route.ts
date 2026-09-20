import { db } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { recordListingEvent } from "@/lib/analytics/query";
import { shouldCountView } from "@/lib/analytics/view-throttle";

/**
 * View beacon for a college application listing.
 *
 * Applications have had a `views` column since the listing type was introduced,
 * but nothing ever wrote to it — the Browse page's "most popular" sort has been
 * ordering by a column that is zero for every row. This beacon fills that in and
 * feeds the writer analytics dashboard at the same time.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!shouldCountView(req, id)) {
    return Response.json({ ok: true, skipped: true });
  }

  const application = await db.query.collegeApplications
    .findFirst({
      where: eq(collegeApplications.id, id),
      columns: { id: true, writerId: true, status: true },
    })
    .catch(() => undefined);

  // Only count traffic to listings that are actually live. A writer previewing
  // their own pending draft should not inflate their funnel.
  if (!application || application.status !== "approved") {
    return Response.json({ ok: true, skipped: true });
  }

  await db
    .update(collegeApplications)
    .set({ views: sql`${collegeApplications.views} + 1` })
    .where(eq(collegeApplications.id, id))
    .catch(() => {});

  await recordListingEvent({
    writerId: application.writerId,
    applicationId: application.id,
    kind: "view",
  });

  return Response.json({ ok: true });
}
