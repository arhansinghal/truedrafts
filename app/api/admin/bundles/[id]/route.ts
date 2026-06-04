import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { resolveBundleMembers, computeBundlePrice } from "@/lib/bundles";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await db.query.bundles.findFirst({ where: eq(bundles.id, id) });
  if (!bundle) return Response.json({ error: "Not found" }, { status: 404 });

  const members = await resolveBundleMembers(bundle);
  const pricing = computeBundlePrice(bundle, members);
  return Response.json({ bundle, members, pricing });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.title === "string") updates.title = body.title;
  if ("description" in body) updates.description = body.description ?? null;
  if ("coverImageUrl" in body) updates.coverImageUrl = body.coverImageUrl ?? null;
  if (body.kind === "static" || body.kind === "rule") updates.kind = body.kind;
  if (Array.isArray(body.applicationIds)) updates.applicationIds = body.applicationIds;
  if ("ruleConfig" in body) {
    updates.ruleConfig = body.ruleConfig ? JSON.stringify(body.ruleConfig) : null;
  }
  if (body.pricingMode === "flat" || body.pricingMode === "percent") {
    updates.pricingMode = body.pricingMode;
  }
  if ("flatPriceCents" in body) {
    updates.flatPriceCents = typeof body.flatPriceCents === "number" ? body.flatPriceCents : null;
  }
  if ("discountPercent" in body) {
    updates.discountPercent =
      typeof body.discountPercent === "number" ? body.discountPercent : null;
  }
  if ("startsAt" in body) updates.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if ("endsAt" in body) updates.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = await db.update(bundles).set(updates as any).where(eq(bundles.id, id)).returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ bundle: row });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Soft-delete via archive — preserves bundle_purchases FK integrity for
  // anyone who already bought in. Hard deletes would orphan their records.
  const [row] = await db
    .update(bundles)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(bundles.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
