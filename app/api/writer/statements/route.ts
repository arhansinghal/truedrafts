import { auth } from "@/lib/auth";
import { availableMonths, derivedBalances } from "@/lib/ledger/statements";

/**
 * GET /api/writer/statements
 *
 * The months this writer has activity in, plus balances derived from the
 * ledger. Scoped to the caller — there is no writerId parameter.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [months, balances] = await Promise.all([
      availableMonths(session.user.id),
      derivedBalances(session.user.id),
    ]);

    return Response.json(
      { months, balances },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[ledger] failed to list statements", err);
    return Response.json({ error: "statements_unavailable" }, { status: 500 });
  }
}
