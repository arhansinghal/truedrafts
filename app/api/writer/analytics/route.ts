import { auth } from "@/lib/auth";
import { loadWriterAnalytics } from "@/lib/analytics/query";
import { parseRangeKey } from "@/lib/analytics/window";

/**
 * GET /api/writer/analytics?range=7d|30d|90d|12m
 *
 * Powers the client-side range picker on /writer/analytics. The page itself
 * server-renders the default 30-day view, so this route only gets hit when a
 * writer switches ranges — no need for caching headers beyond `no-store`.
 *
 * Scoped hard to the calling writer. There is no `writerId` parameter and there
 * should never be one: admins get their own aggregate views under /admin.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const range = parseRangeKey(url.searchParams.get("range"));

  try {
    const payload = await loadWriterAnalytics(session.user.id, range);
    return Response.json(payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[analytics] failed to build payload", err);
    return Response.json(
      { error: "analytics_unavailable" },
      { status: 500 },
    );
  }
}
