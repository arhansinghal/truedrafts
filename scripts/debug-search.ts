import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications, universities } from "../lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

function buildTextMatchCondition(terms: string[]) {
  const clean = Array.from(
    new Set(
      terms
        .map((t) => (t ?? "").toString().toLowerCase().trim())
        .filter((t) => t.length >= 2)
    )
  );
  if (clean.length === 0) return null;
  const haystack = sql`lower(
    coalesce(${collegeApplications.vibeSearchText}, '') || ' ' ||
    coalesce(${collegeApplications.title}, '') || ' ' ||
    coalesce(${collegeApplications.major}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppContent}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppPrompt}, '') || ' ' ||
    coalesce(${collegeApplications.supplementals}, '') || ' ' ||
    array_to_string(coalesce(${collegeApplications.tags}, '{}'::text[]), ' ')
  )`;
  const clauses = clean.map((t) => sql`${haystack} LIKE ${"%" + t + "%"}`);
  return sql`(${sql.join(clauses, sql` OR `)})`;
}

async function runSearch(label: string, opts: { uniSlug?: string; terms: string[] }) {
  const where: any[] = [eq(collegeApplications.status, "approved")];
  if (opts.uniSlug) {
    const u = await db.query.universities.findFirst({ where: eq(universities.slug, opts.uniSlug) });
    if (u) where.push(eq(collegeApplications.universityId, u.id));
  }
  const tc = buildTextMatchCondition(opts.terms);
  if (tc) where.push(tc);
  const rows = await db.query.collegeApplications.findMany({
    where: and(...where),
    with: { university: { columns: { slug: true, name: true } } },
    limit: 10,
  });
  console.log(`\n=== ${label} → ${rows.length} rows ===`);
  for (const r of rows.slice(0, 5)) {
    console.log(` - ${r.university?.slug?.padEnd(12) ?? "?"} ${r.title}`);
  }
}

async function main() {
  // Simulate what happens end-to-end for each query, assuming no AI key.
  // "penn" → fallback detects uni=upenn, strips from terms → uni filter only.
  await runSearch('search "penn"', { uniSlug: "upenn", terms: [] });
  // "robotics" → no uni match, terms=["robotics"]
  await runSearch('search "robotics"', { terms: ["robotics"] });
  // "debate" → no uni match, terms=["debate"]
  await runSearch('search "debate"', { terms: ["debate"] });
  // sanity: all approved
  const all = await db.query.collegeApplications.findMany({
    where: eq(collegeApplications.status, "approved"),
    with: { university: { columns: { slug: true } } },
  });
  console.log(`\nTotal approved: ${all.length}`);
  const byUni = new Map<string, number>();
  for (const a of all) {
    const k = a.university?.slug ?? "?";
    byUni.set(k, (byUni.get(k) ?? 0) + 1);
  }
  console.log("By uni:", Object.fromEntries(byUni));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
