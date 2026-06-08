import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { resolveBundleMembers, computeBundlePrice } from "@/lib/bundles";
import { eq } from "drizzle-orm";

export async function POST(
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

  // Pre-publish validation. We refuse to publish anything that would render
  // a broken card or take a buyer's money for nothing.
  const members = await resolveBundleMembers(bundle);
  if (members.length === 0) {
    return Response.json(
      { error: "Cannot publish: bundle resolves to zero approved applications" },
      { status: 400 },
    );
  }
  if (members.length < 2) {
    return Response.json(
      { error: "Bundles must contain at least 2 applications" },
      { status: 400 },
    );
  }
  if (bundle.pricingMode === "flat" && (bundle.flatPriceCents ?? 0) <= 0) {
    return Response.json({ error: "Flat-priced bundle requires a positive price" }, { status: 400 });
  }
  if (
    bundle.pricingMode === "percent" &&
    (bundle.discountPercent === null || bundle.discountPercent <= 0)
  ) {
    return Response.json(
      { error: "Percent-discount bundle requires a positive discount" },
      { status: 400 },
    );
  }
  const pricing = computeBundlePrice(bundle, members);
  if (pricing.finalPrice <= 0) {
    return Response.json(
      { error: "Bundle final price must be > ₹0 — adjust pricing" },
      { status: 400 },
    );
  }

  const [row] = await db
    .update(bundles)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(bundles.id, id))
    .returning();

  return Response.json({ bundle: row });
}
