import { auth } from "@/lib/auth";
import { db, essays, purchases } from "@/lib/db";
import { collegeApplications } from "@/lib/db/schema";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { toCsv, type CsvRow } from "@/lib/csv";

/**
 * GET /api/writer/earnings/export?month=2026-09
 *
 * One row per sale in the given month, for the writer's own records and for
 * whoever does their taxes. Defaults to the current month.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "writer") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const writerId = session.user.id;

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month");
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12

  if (monthParam) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (!m) {
      return Response.json(
        { error: "month must look like 2026-09" },
        { status: 400 },
      );
    }
    year = Number(m[1]);
    month = Number(m[2]);
    if (month < 1 || month > 12) {
      return Response.json({ error: "month out of range" }, { status: 400 });
    }
  }

  // First instant of the month → last day of the month.
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const [writerEssays, writerApps] = await Promise.all([
    db.query.essays.findMany({
      where: eq(essays.writerId, writerId),
      columns: { id: true },
    }),
    db.query.collegeApplications.findMany({
      where: eq(collegeApplications.writerId, writerId),
      columns: { id: true },
    }),
  ]);

  const essayIds = writerEssays.map((e) => e.id);
  const appIds = writerApps.map((a) => a.id);
  if (essayIds.length === 0 && appIds.length === 0) {
    return csvResponse("", year, month);
  }

  const sales = await db.query.purchases.findMany({
    where: and(
      essayIds.length > 0
        ? inArray(purchases.essayId, essayIds)
        : inArray(purchases.applicationId, appIds),
      gte(purchases.purchasedAt, start),
      lte(purchases.purchasedAt, end),
    ),
    orderBy: (p, { asc }) => [asc(p.purchasedAt)],
  });

  const rows: CsvRow[] = [];
  for (const sale of sales) {
    // Title for the line item — essays and applications live in different
    // tables, so resolve per row.
    let title = "";
    if (sale.essayId) {
      const essay = await db.query.essays.findFirst({
        where: eq(essays.id, sale.essayId),
        columns: { title: true },
      });
      title = essay?.title ?? "";
    } else if (sale.applicationId) {
      const app = await db.query.collegeApplications.findFirst({
        where: eq(collegeApplications.id, sale.applicationId),
        columns: { title: true },
      });
      title = app?.title ?? "";
    }

    rows.push({
      date: sale.purchasedAt?.toISOString().slice(0, 10) ?? "",
      item: title,
      kind: sale.essayId ? "essay" : "application",
      gross_paise: sale.amountCents,
      platform_fee_paise: sale.platformFeeCents,
      your_earnings_paise: sale.writerPayoutCents,
      purchase_id: sale.id,
    });
  }

  return csvResponse(toCsv(rows), year, month);
}

function csvResponse(body: string, year: number, month: number): Response {
  const name = `truedrafts-earnings-${year}-${String(month).padStart(2, "0")}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
