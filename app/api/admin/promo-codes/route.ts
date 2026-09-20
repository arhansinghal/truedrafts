import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { promoCodes, promoRedemptions } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { normalizeCode, validateTermsInput } from "@/lib/promo";
import { optionalDate, optionalInt, parseScope } from "@/lib/promo-admin";
import { desc, eq, sql } from "drizzle-orm";

/**
 * GET /api/admin/promo-codes
 *
 * Every code plus its live redemption count. The denormalised `timesRedeemed`
 * counter only moves when a payment is granted, so the admin table shows both:
 * "claimed" (reservations in flight) and "redeemed" (money actually taken).
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: promoCodes.id,
      code: promoCodes.code,
      description: promoCodes.description,
      kind: promoCodes.kind,
      percentOff: promoCodes.percentOff,
      flatOffCents: promoCodes.flatOffCents,
      maxDiscountCents: promoCodes.maxDiscountCents,
      minSubtotalCents: promoCodes.minSubtotalCents,
      scope: promoCodes.scope,
      maxRedemptions: promoCodes.maxRedemptions,
      maxRedemptionsPerUser: promoCodes.maxRedemptionsPerUser,
      timesRedeemed: promoCodes.timesRedeemed,
      startsAt: promoCodes.startsAt,
      endsAt: promoCodes.endsAt,
      active: promoCodes.active,
      createdAt: promoCodes.createdAt,
    })
    .from(promoCodes)
    .orderBy(desc(promoCodes.createdAt));

  // One extra query rather than N: pull reservation counts for every code at
  // once and stitch them on in memory.
  const claimed = await db
    .select({
      promoCodeId: promoRedemptions.promoCodeId,
      count: sql<number>`count(*)::int`,
      discountedCents: sql<number>`coalesce(sum(${promoRedemptions.discountCents}), 0)::int`,
    })
    .from(promoRedemptions)
    .where(sql`${promoRedemptions.status} <> 'void'`)
    .groupBy(promoRedemptions.promoCodeId);

  const claimedById = new Map(claimed.map((c) => [c.promoCodeId, c]));

  return Response.json(
    rows.map((row) => ({
      ...row,
      claimedCount: claimedById.get(row.id)?.count ?? 0,
      discountedCents: claimedById.get(row.id)?.discountedCents ?? 0,
    })),
  );
}

/**
 * POST /api/admin/promo-codes — create a code.
 */
export async function POST(req: Request) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const problems = validateTermsInput(body);
  if (problems.length > 0) {
    return Response.json({ error: "invalid", problems }, { status: 422 });
  }

  const code = normalizeCode(String(body.code));

  const duplicate = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.code, code),
    columns: { id: true },
  });
  if (duplicate) {
    return Response.json(
      { error: "invalid", problems: [`${code} already exists.`] },
      { status: 409 },
    );
  }

  const kind = body.kind === "flat" ? "flat" : "percent";

  const inserted = await db
    .insert(promoCodes)
    .values({
      code,
      description:
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null,
      kind,
      percentOff: kind === "percent" ? optionalInt(body.percentOff) : null,
      flatOffCents: kind === "flat" ? optionalInt(body.flatOffCents) : null,
      maxDiscountCents: optionalInt(body.maxDiscountCents),
      minSubtotalCents: optionalInt(body.minSubtotalCents) ?? 0,
      scope: parseScope(body.scope),
      maxRedemptions: optionalInt(body.maxRedemptions),
      maxRedemptionsPerUser: optionalInt(body.maxRedemptionsPerUser) ?? 1,
      startsAt: optionalDate(body.startsAt),
      endsAt: optionalDate(body.endsAt),
      active: body.active === false ? false : true,
      createdBy: session.user.id,
    })
    .returning({ id: promoCodes.id, code: promoCodes.code });

  return Response.json({ ok: true, ...inserted[0] }, { status: 201 });
}
