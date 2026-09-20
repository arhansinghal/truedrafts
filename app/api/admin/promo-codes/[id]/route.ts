import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { promoCodes, promoRedemptions } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { normalizeCode, validateTermsInput } from "@/lib/promo";
import {
  codeExistsElsewhere,
  optionalDate,
  optionalInt,
  parseScope,
} from "@/lib/promo-admin";
import { eq, sql } from "drizzle-orm";

/**
 * PATCH /api/admin/promo-codes/[id] — edit a code.
 *
 * Editing never rewrites history: redemptions snapshot the terms they were
 * reserved under, so changing a live campaign only affects future checkouts.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.query.promoCodes.findFirst({
    where: eq(promoCodes.id, id),
  });
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  // A PATCH that only flips `active` is the common case (pausing a campaign);
  // don't make the caller resend every field just to satisfy validation.
  const isToggleOnly =
    Object.keys(body).length === 1 && typeof body.active === "boolean";

  if (isToggleOnly) {
    await db
      .update(promoCodes)
      .set({ active: body.active as boolean, updatedAt: new Date() })
      .where(eq(promoCodes.id, id));
    return Response.json({ ok: true });
  }

  const merged = {
    code: body.code ?? existing.code,
    kind: body.kind ?? existing.kind,
    percentOff: body.percentOff ?? existing.percentOff,
    flatOffCents: body.flatOffCents ?? existing.flatOffCents,
    maxDiscountCents: body.maxDiscountCents ?? existing.maxDiscountCents,
    minSubtotalCents: body.minSubtotalCents ?? existing.minSubtotalCents,
    maxRedemptions: body.maxRedemptions ?? existing.maxRedemptions,
    maxRedemptionsPerUser:
      body.maxRedemptionsPerUser ?? existing.maxRedemptionsPerUser,
    startsAt: body.startsAt ?? existing.startsAt,
    endsAt: body.endsAt ?? existing.endsAt,
  };

  const problems = validateTermsInput(merged);
  if (problems.length > 0) {
    return Response.json({ error: "invalid", problems }, { status: 422 });
  }

  const code = normalizeCode(String(merged.code));
  if (code !== existing.code && (await codeExistsElsewhere(code, id))) {
    return Response.json(
      { error: "invalid", problems: [`${code} already exists.`] },
      { status: 409 },
    );
  }

  const kind = merged.kind === "flat" ? "flat" : "percent";

  await db
    .update(promoCodes)
    .set({
      code,
      description:
        typeof body.description === "string"
          ? body.description.trim() || null
          : existing.description,
      kind,
      percentOff: kind === "percent" ? optionalInt(merged.percentOff) : null,
      flatOffCents: kind === "flat" ? optionalInt(merged.flatOffCents) : null,
      maxDiscountCents: optionalInt(merged.maxDiscountCents),
      minSubtotalCents: optionalInt(merged.minSubtotalCents) ?? 0,
      scope: body.scope === undefined ? existing.scope : parseScope(body.scope),
      maxRedemptions: optionalInt(merged.maxRedemptions),
      maxRedemptionsPerUser: optionalInt(merged.maxRedemptionsPerUser) ?? 1,
      startsAt: optionalDate(merged.startsAt),
      endsAt: optionalDate(merged.endsAt),
      active: typeof body.active === "boolean" ? body.active : existing.active,
      updatedAt: new Date(),
    })
    .where(eq(promoCodes.id, id));

  return Response.json({ ok: true });
}

/**
 * DELETE /api/admin/promo-codes/[id]
 *
 * A code that has ever been redeemed is deactivated rather than deleted — the
 * redemption rows reference it, and a finance question six months from now
 * should still be answerable.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const used = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(promoRedemptions)
    .where(eq(promoRedemptions.promoCodeId, id));

  if ((used[0]?.count ?? 0) > 0) {
    await db
      .update(promoCodes)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(promoCodes.id, id));
    return Response.json({ ok: true, deactivated: true });
  }

  await db.delete(promoCodes).where(eq(promoCodes.id, id));
  return Response.json({ ok: true, deleted: true });
}
