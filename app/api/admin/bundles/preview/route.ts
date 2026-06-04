import { auth } from "@/lib/auth";
import { resolveBundleMembers, computeBundlePrice } from "@/lib/bundles";
import type { Bundle } from "@/lib/db/schema";

/**
 * Stateless preview endpoint used by the admin form. POSTs a *hypothetical*
 * bundle config (not persisted) and returns its resolved members + computed
 * price. Lets admins iterate on rules without saving drafts.
 */
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const fakeBundle: Bundle = {
    id: "preview",
    slug: "preview",
    title: "preview",
    description: null,
    coverImageUrl: null,
    kind: body.kind === "rule" ? "rule" : "static",
    applicationIds: Array.isArray(body.applicationIds) ? body.applicationIds : [],
    ruleConfig: body.ruleConfig ? JSON.stringify(body.ruleConfig) : null,
    pricingMode: body.pricingMode === "percent" ? "percent" : "flat",
    flatPriceCents: typeof body.flatPriceCents === "number" ? body.flatPriceCents : null,
    discountPercent: typeof body.discountPercent === "number" ? body.discountPercent : null,
    startsAt: null,
    endsAt: null,
    status: "draft",
    createdBy: session.user.id,
    createdAt: new Date(),
    publishedAt: null,
    updatedAt: new Date(),
  };

  const members = await resolveBundleMembers(fakeBundle);
  const pricing = computeBundlePrice(fakeBundle, members);
  return Response.json({ members, pricing });
}
