import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bundles } from "@/lib/db/schema";
import { generateSlug } from "@/lib/utils";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.select().from(bundles).orderBy(desc(bundles.createdAt));
  return Response.json({ bundles: rows });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title: string = (body.title ?? "").trim();
  if (!title) return Response.json({ error: "Title required" }, { status: 400 });

  const kind: "static" | "rule" = body.kind === "rule" ? "rule" : "static";
  const pricingMode: "flat" | "percent" = body.pricingMode === "percent" ? "percent" : "flat";

  const [row] = await db
    .insert(bundles)
    .values({
      slug: generateSlug(title),
      title,
      description: body.description ?? null,
      coverImageUrl: body.coverImageUrl ?? null,
      kind,
      applicationIds: Array.isArray(body.applicationIds) ? body.applicationIds : [],
      ruleConfig: body.ruleConfig ? JSON.stringify(body.ruleConfig) : null,
      pricingMode,
      flatPriceCents: typeof body.flatPriceCents === "number" ? body.flatPriceCents : null,
      discountPercent: typeof body.discountPercent === "number" ? body.discountPercent : null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      status: "draft",
      createdBy: session.user.id,
    })
    .returning();

  return Response.json({ bundle: row }, { status: 201 });
}
