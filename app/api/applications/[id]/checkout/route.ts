import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
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

  const existing = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, session.user.id),
      eq(purchases.applicationId, id),
      eq(purchases.status, "completed"),
    ),
  });
  if (existing) {
    return Response.json({ error: "Already purchased" }, { status: 400 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: { university: { columns: { name: true } } },
  });

  if (!app || app.status !== "approved") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (app.writerId === session.user.id) {
    return Response.json(
      { error: "You cannot purchase your own application" },
      { status: 400 },
    );
  }

  if (app.priceCents < 100) {
    return Response.json(
      { error: "Application price below Razorpay minimum (₹1)" },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      amount: app.priceCents,
      currency: "INR",
      receipt: `app_${randomUUID().slice(0, 16)}`,
      notes: {
        kind: "application",
        ref_id: app.id,
        buyer_id: session.user.id,
      },
    });

    return Response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      name: "TrueDrafts",
      description: `Unlock: ${app.title}`.slice(0, 250),
      prefill: { email: session.user.email, name: session.user.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Razorpay application checkout error:", message);
    const status = (err as Error & { status?: number }).status === 401 ? 401 : 500;
    return Response.json(
      { error: status === 401 ? "Payment auth failed" : "Checkout failed" },
      { status },
    );
  }
}
