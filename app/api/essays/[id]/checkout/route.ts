import { auth } from "@/lib/auth";
import { db, essays, purchases } from "@/lib/db";
import { createOrder } from "@/lib/razorpay";
import { isTrustedOrigin } from "@/lib/csrf";
import { eq, and } from "drizzle-orm";
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
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Writer accounts can browse but not purchase.
  if (session.user.role === "writer") {
    return Response.json(
      { error: "Writer accounts can't purchase." },
      { status: 403 },
    );
  }

  const existing = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, session.user.id),
      eq(purchases.essayId, id),
      eq(purchases.status, "completed"),
    ),
  });
  if (existing) {
    return Response.json({ error: "Already purchased" }, { status: 400 });
  }

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
  });

  if (!essay || essay.status !== "approved") {
    return Response.json({ error: "Essay not found" }, { status: 404 });
  }

  if (essay.writerId === session.user.id) {
    return Response.json(
      { error: "You cannot purchase your own essay" },
      { status: 400 },
    );
  }

  if (essay.priceCents < 100) {
    return Response.json(
      { error: "Essay price below Razorpay minimum (₹1)" },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      amount: essay.priceCents,
      currency: "INR",
      receipt: `essay_${randomUUID().slice(0, 16)}`,
      notes: {
        kind: "essay",
        ref_id: essay.id,
        buyer_id: session.user.id,
      },
    });

    return Response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      name: "TrueDrafts",
      description: `Unlock: ${essay.title}`.slice(0, 250),
      prefill: { email: session.user.email, name: session.user.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Razorpay essay checkout error:", message);
    const status = (err as Error & { status?: number }).status === 401 ? 401 : 500;
    return Response.json(
      { error: status === 401 ? "Payment auth failed" : "Checkout failed" },
      { status },
    );
  }
}
