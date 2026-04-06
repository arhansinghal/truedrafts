import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
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
      eq(purchases.applicationId, id),
      eq(purchases.status, "completed")
    ),
  });
  if (existing) {
    return Response.json({ error: "Already purchased" }, { status: 400 });
  }

  const app = await db.query.collegeApplications.findFirst({
    where: eq(collegeApplications.id, id),
    with: { university: true },
  });

  if (!app || app.status !== "approved") {
    return Response.json({ error: "Not found" }, { status: 404 });
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
            unit_amount: app.priceCents,
            product_data: {
              name: app.title.length > 250 ? app.title.slice(0, 247) + "..." : app.title,
              description: `Full college application to ${app.university?.name ?? "University"}. Class of ${app.admittedYear ?? 2025}.`,
            },
          },
        },
      ],
      metadata: {
        application_id: app.id,
        buyer_id: session.user.id,
      },
      success_url: `${appUrl}/applications/${app.slug}?purchased=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/applications/${app.slug}`,
    });

    return Response.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe checkout error:", message);
    return Response.json({ error: "Checkout failed", detail: message }, { status: 500 });
  }
}
