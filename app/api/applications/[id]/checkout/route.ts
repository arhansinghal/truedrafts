import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, purchases } from "@/lib/db/schema";
import { polarClient } from "@/lib/polar";
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
    let polarProductId = app.polarProductId;

    if (!polarProductId) {
      const product = await polarClient.products.create({
        name: app.title,
        description: `Full college application to ${app.university?.name ?? "University"}. Class of ${app.admittedYear ?? 2025}.`,
        prices: [
          {
            amountType: "fixed",
            priceAmount: app.priceCents,
            priceCurrency: "usd",
          },
        ],
      });
      polarProductId = product.id;
      await db
        .update(collegeApplications)
        .set({ polarProductId })
        .where(eq(collegeApplications.id, id));
    }

    const appUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

    const checkout = await polarClient.checkouts.create({
      products: [polarProductId],
      customerEmail: session.user.email,
      successUrl: `${appUrl}/applications/${app.slug}?purchased=true&checkout_id={CHECKOUT_ID}`,
      metadata: {
        application_id: app.id,
        buyer_id: session.user.id,
      },
    });

    return Response.json({ url: checkout.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Polar checkout error:", message);
    return Response.json({ error: "Checkout failed", detail: message }, { status: 500 });
  }
}
