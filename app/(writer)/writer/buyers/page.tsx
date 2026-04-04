import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchases, collegeApplications, users, universities } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { BuyersList } from "@/components/writer/BuyersList";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Buyers" };

export default async function BuyersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "writer") redirect("/login");

  // Get writer's applications
  const myApps = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.writerId, session.user.id),
    columns: { id: true, title: true, universityId: true },
    with: { university: { columns: { name: true, logoUrl: true, slug: true } } },
  });

  const myAppIds = myApps.map((a) => a.id);

  const rows = myAppIds.length === 0
    ? []
    : await db
        .select({
          id: purchases.id,
          buyerName: users.name,
          buyerEmail: users.email,
          applicationId: purchases.applicationId,
          uniName: universities.name,
          uniLogo: universities.logoUrl,
          uniSlug: universities.slug,
          amountCents: purchases.amountCents,
          writerPayoutCents: purchases.writerPayoutCents,
          purchasedAt: purchases.purchasedAt,
        })
        .from(purchases)
        .innerJoin(users, eq(purchases.buyerId, users.id))
        .innerJoin(collegeApplications, eq(purchases.applicationId, collegeApplications.id))
        .innerJoin(universities, eq(collegeApplications.universityId, universities.id))
        .where(
          and(
            eq(collegeApplications.writerId, session.user.id),
            eq(purchases.status, "completed")
          )
        )
        .orderBy(desc(purchases.purchasedAt));

  const appTitleMap = Object.fromEntries(myApps.map((a) => [a.id, a.title]));

  const buyers = rows.map((r) => ({
    id: r.id,
    buyerName: r.buyerName,
    buyerEmail: r.buyerEmail,
    essayTitle: r.applicationId ? (appTitleMap[r.applicationId] ?? "Application") : "Application",
    uniName: r.uniName,
    uniLogo: r.uniLogo,
    uniSlug: r.uniSlug,
    amountCents: r.amountCents,
    writerPayoutCents: r.writerPayoutCents,
    purchasedAt: r.purchasedAt,
  }));

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Buyers</h1>
        <p className="text-gray-500 text-sm mt-1">{buyers.length} total purchase{buyers.length !== 1 ? "s" : ""}</p>
      </div>
      <BuyersList buyers={buyers} />
    </div>
  );
}
