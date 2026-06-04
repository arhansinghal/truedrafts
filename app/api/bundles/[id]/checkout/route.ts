import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles, pendingBundleCheckouts } from "@/lib/db/schema";
import {
  resolveBundleMembers,
  computeBundlePrice,
  checkBuyerOverlap,
  bundleAvailability,
} from "@/lib/bundles";
import { createOrder } from "@/lib/razorpay";
import { isTrustedOrigin } from "@/lib/csrf";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedOrigin(req)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bundle = await db.query.bundles.findFirst({ where: eq(bundles.id, id) });
  if (!bundle) return Response.json({ error: "Not found" }, { status: 404 });

  // Resolve members + price at request time so we always charge against the
  // live universe, not a stale snapshot.
  const members = await resolveBundleMembers(bundle);

  // Block writers from buying a bundle that contains any of their own apps —
  // would create self-paid earnings and confuse the pro-rata split.
  if (members.some((m) => m.writerId === session.user.id)) {
    return Response.json(
      { error: "You cannot purchase a bundle containing your own applications" },
      { status: 400 },
    );
  }

  const overlap = await checkBuyerOverlap(session.user.id, members.map((m) => m.id));
  const status = bundleAvailability(bundle, members.length, overlap.length);

  switch (status) {
    case "available":
      break;
    case "draft":
    case "archived":
    case "empty":
    case "not_started":
    case "expired":
      return Response.json(
        { error: `Bundle not available (${status})` },
        { status: 400 },
      );
    case "owns_some":
      return Response.json(
        { error: "You already own one or more applications in this bundle." },
        { status: 400 },
      );
  }

  const pricing = computeBundlePrice(bundle, members);
  if (pricing.finalPrice < 100) {
    return Response.json(
      { error: "Bundle price below Razorpay minimum (₹1)" },
      { status: 400 },
    );
  }

  // Snapshot members + their individual prices so the grant path can split
  // proceeds correctly even if prices change between order and capture.
  const priceSnapshot = members.map((m) => ({
    applicationId: m.id,
    priceCents: m.priceCents,
  }));
  const applicationIdsSnapshot = members.map((m) => m.id);

  // Insert the pending row BEFORE calling Razorpay so the grant path can
  // always find the snapshot for any captured order. We use a temporary
  // placeholder for razorpayOrderId, then UPDATE with the real value once
  // Razorpay returns. If Razorpay creation fails, we delete the placeholder.
  // If the UPDATE fails (rare), we delete by placeholder and report failure;
  // the Razorpay order will expire unused.
  const placeholderOrderId = `pending_${randomUUID()}`;
  try {
    await db.insert(pendingBundleCheckouts).values({
      razorpayOrderId: placeholderOrderId,
      bundleId: bundle.id,
      buyerId: session.user.id,
      totalCents: pricing.finalPrice,
      applicationIdsSnapshot,
      priceSnapshot: JSON.stringify(priceSnapshot),
    });
  } catch (err) {
    console.error("Razorpay bundle checkout: pending insert failed:", err);
    return Response.json({ error: "Checkout failed" }, { status: 500 });
  }

  let order;
  try {
    order = await createOrder({
      amount: pricing.finalPrice,
      currency: "INR",
      receipt: `bundle_${randomUUID().slice(0, 16)}`,
      notes: {
        kind: "bundle",
        ref_id: bundle.id,
        buyer_id: session.user.id,
      },
    });
  } catch (err) {
    // Roll back the placeholder so abandoned pending rows don't pile up.
    await db
      .delete(pendingBundleCheckouts)
      .where(eq(pendingBundleCheckouts.razorpayOrderId, placeholderOrderId))
      .catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    console.error("Razorpay bundle checkout error:", message);
    const status = (err as Error & { status?: number }).status === 401 ? 401 : 500;
    return Response.json(
      { error: status === 401 ? "Payment auth failed" : "Checkout failed" },
      { status },
    );
  }

  try {
    await db
      .update(pendingBundleCheckouts)
      .set({ razorpayOrderId: order.id })
      .where(eq(pendingBundleCheckouts.razorpayOrderId, placeholderOrderId));
  } catch (err) {
    console.error(
      `Bundle checkout: pending row update to real order_id failed. ` +
        `Placeholder ${placeholderOrderId}, Razorpay order ${order.id} is now orphaned.`,
      err,
    );
    await db
      .delete(pendingBundleCheckouts)
      .where(eq(pendingBundleCheckouts.razorpayOrderId, placeholderOrderId))
      .catch(() => {});
    return Response.json({ error: "Checkout failed" }, { status: 500 });
  }

  return Response.json({
    order_id: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    name: "TrueDrafts",
    description: `${bundle.title} — ${members.length} applications, save ${pricing.savingsPercent}%`
      .slice(0, 250),
    prefill: { email: session.user.email, name: session.user.name },
  });
}
