import { auth } from "@/lib/auth";
import {
  DEFAULT_PAGE_SIZE,
  distinctActions,
  loadAuditPage,
  normalizePage,
  normalizePageSize,
} from "@/lib/audit/query";

/** Parse an optional ISO date filter. Invalid input is ignored, not rejected. */
function optionalDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/admin/audit
 *
 * Query: page, pageSize, action, actorId, targetType, targetId, since, until.
 *
 * Admin-only, and read-only: nothing in the app can edit or delete an audit
 * entry, which is the whole point of having one.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;

  try {
    const [page, actions] = await Promise.all([
      loadAuditPage({
        page: normalizePage(params.get("page") ?? 1),
        pageSize: normalizePageSize(params.get("pageSize") ?? DEFAULT_PAGE_SIZE),
        filters: {
          action: params.get("action"),
          actorId: params.get("actorId"),
          targetType: params.get("targetType"),
          targetId: params.get("targetId"),
          since: optionalDate(params.get("since")),
          until: optionalDate(params.get("until")),
        },
      }),
      distinctActions(),
    ]);

    return Response.json(
      { ...page, actions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[audit] failed to load page", err);
    return Response.json({ error: "audit_unavailable" }, { status: 500 });
  }
}
