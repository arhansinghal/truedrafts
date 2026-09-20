import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, essays, bundles } from "@/lib/db/schema";
import { isTrustedOrigin } from "@/lib/csrf";
import { evaluateCode } from "@/lib/promo-store";
import { computeBundlePrice, resolveBundleMembers } from "@/lib/bundles";
import { eq } from "drizzle-orm";

/**
 * POST /api/promo/validate
 * body: { code, listingKind: "essay"|"application"|"bundle", listingId }
 *
 * Quotes a code against a listing so the checkout box can show the new total
 * before the buyer commits. Nothing is reserved here — this is a read.
 *
 * The subtotal is always read from the database. The client sends an id, never
 * a price; otherwise a buyer could quote themselves a 90% discount on a
 * made-up subtotal and we would happily agree.
 */
export async function POST(req: Request) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: unknown; listingKind?: unknown; listingId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const listingKind = body.listingKind;

  if (!code.trim()) {
    return Response.json({ error: "Enter a code" }, { status: 400 });
  }
  if (
    listingKind !== "essay" &&
    listingKind !== "application" &&
    listingKind !== "bundle"
  ) {
    return Response.json({ error: "Invalid listing kind" }, { status: 400 });
  }
  if (!listingId) {
    return Response.json({ error: "Invalid listing" }, { status: 400 });
  }

  const subtotalCents = await subtotalFor(listingKind, listingId);
  if (subtotalCents === null) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await evaluateCode({
    raw: code,
    buyerId: session.user.id,
    subtotalCents,
    listingKind,
  });

  if (!result.ok) {
    // 200, not 4xx: a code that doesn't apply is an ordinary answer to a
    // question, not a failed request, and the box renders the message inline.
    return Response.json({
      ok: false,
      reason: result.reason,
      message: result.message,
    });
  }

  return Response.json({
    ok: true,
    code: result.terms.code,
    subtotalCents: result.quote.subtotalCents,
    discountCents: result.quote.discountCents,
    chargedCents: result.quote.chargedCents,
  });
}

/** The authoritative price of a listing, or null if it isn't purchasable. */
async function subtotalFor(
  kind: "essay" | "application" | "bundle",
  id: string,
): Promise<number | null> {
  if (kind === "application") {
    const row = await db.query.collegeApplications.findFirst({
      where: eq(collegeApplications.id, id),
      columns: { priceCents: true, status: true },
    });
    if (!row || row.status !== "approved") return null;
    return row.priceCents;
  }

  if (kind === "essay") {
    const row = await db.query.essays.findFirst({
      where: eq(essays.id, id),
      columns: { priceCents: true, status: true },
    });
    if (!row || row.status !== "approved") return null;
    return row.priceCents;
  }

  const bundle = await db.query.bundles.findFirst({
    where: eq(bundles.id, id),
  });
  if (!bundle || bundle.status !== "published") return null;

  const members = await resolveBundleMembers(bundle);
  if (members.length === 0) return null;
  return computeBundlePrice(bundle, members).finalPrice;
}
