import { auth } from "@/lib/auth";
import { db, essays, purchases } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.query.purchases.findFirst({
    where: and(
      eq(purchases.buyerId, session.user.id),
      eq(purchases.essayId, id),
      eq(purchases.status, "completed")
    ),
  });
  if (existing) {
    return Response.json({ error: "Already purchased" }, { status: 400 });
  }

  const essay = await db.query.essays.findFirst({
    where: eq(essays.id, id),
    with: { university: true },
  });

  if (!essay || essay.status !== "approved") {
    return Response.json({ error: "Essay not found" }, { status: 404 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: session.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: essay.priceCents,
            product_data: {
              name: essay.title.length > 250 ? essay.title.slice(0, 247) + "..." : essay.title,
              description: `Full essay access. Admitted ${essay.admittedYear ?? "recently"}.`,
            },
          },
        },
      ],
      metadata: {
        essay_id: essay.id,
        buyer_id: session.user.id,
      },
      success_url: `${appUrl}/essays/${essay.slug}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/essays/${essay.slug}`,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe checkout error:", message);
    return Response.json({ error: "Checkout failed", detail: message }, { status: 500 });
  }
}
