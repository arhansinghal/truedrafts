import { auth } from "@/lib/auth";
import { parseMonthKey } from "@/lib/ledger/compute";
import { buildStatement } from "@/lib/ledger/statements";

/**
 * GET /api/writer/statements/[month] — one month, e.g. `2026-09`.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ month: string }> },
) {
  const { month } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseMonthKey(month);
  if (!parsed) {
    return Response.json(
      { error: "Expected a month like 2026-09" },
      { status: 400 },
    );
  }

  try {
    const statement = await buildStatement(
      session.user.id,
      parsed.year,
      parsed.month,
    );
    return Response.json(statement, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[ledger] failed to build statement", err);
    return Response.json({ error: "statement_unavailable" }, { status: 500 });
  }
}
