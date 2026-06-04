import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { collegeApplications, universities } from "@/lib/db/schema";
import { and, eq, ilike, or, asc } from "drizzle-orm";

/**
 * Lightweight picker source for the static-bundle multiselect. Returns ALL
 * approved applications (admin tooling — no pagination) with the minimum
 * fields needed to render a card and price-preview a bundle.
 */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const conditions = [eq(collegeApplications.status, "approved")];
  if (q) {
    conditions.push(
      or(
        ilike(collegeApplications.title, `%${q}%`),
        ilike(universities.name, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select({
      id: collegeApplications.id,
      title: collegeApplications.title,
      slug: collegeApplications.slug,
      priceCents: collegeApplications.priceCents,
      admittedYear: collegeApplications.admittedYear,
      university: { id: universities.id, name: universities.name, slug: universities.slug },
    })
    .from(collegeApplications)
    .innerJoin(universities, eq(collegeApplications.universityId, universities.id))
    .where(and(...conditions))
    .orderBy(asc(universities.name), asc(collegeApplications.title));

  return Response.json({ applications: rows });
}
