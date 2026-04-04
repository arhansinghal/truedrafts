import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import { db, essays, purchases } from "@/lib/db";
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

  // Check not already purchased
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
  });

  if (!essay || essay.status !== "approved") {
    return Response.json({ error: "Essay not found" }, { status: 404 });
  }

  if (!essay.polarProductId) {
    return Response.json({ error: "Payment not configured" }, { status: 500 });
  }

  try {
    const checkout = await polarClient.checkouts.create({
      products: [essay.polarProductId!],
      customerEmail: session.user.email,
      successUrl: `${process.env.NEXT_PUBLIC_URL}/essays/${essay.slug}?purchased=true`,
      metadata: {
        essay_id: essay.id,
        buyer_id: session.user.id,
      },
    });

    return Response.json({ url: checkout.url });
  } catch (err) {
    console.error("Polar checkout error:", err);
    return Response.json({ error: "Checkout failed" }, { status: 500 });
  }
}
