import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/db";
import { collegeApplications, universities } from "../lib/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { parseVibeSearchQuery, IVY_UNIVERSITY_SLUGS } from "../lib/vibe-anthropic";
import { expandSearchTokens, buildFilterTokens } from "../lib/search-tokens";

function buildTextMatchCondition(tokens: string[]) {
  if (tokens.length === 0) return null;
  const haystack = sql`lower(
    coalesce(${collegeApplications.vibeSearchText}, '') || ' ' ||
    coalesce(${collegeApplications.title}, '') || ' ' ||
    coalesce(${collegeApplications.major}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppContent}, '') || ' ' ||
    coalesce(${collegeApplications.commonAppPrompt}, '') || ' ' ||
    coalesce(${collegeApplications.supplementals}, '') || ' ' ||
    array_to_string(coalesce(${collegeApplications.tags}, '{}'::text[]), ' ')
  )`;
  const clauses = tokens.map((t) => sql`${haystack} LIKE ${"%" + t.toLowerCase() + "%"}`);
  return sql`(${sql.join(clauses, sql` OR `)})`;
}

async function runQuery(q: string) {
  const intent = await parseVibeSearchQuery(q);
  const unis = await db.query.universities.findMany();
  const ivyIds = unis.filter(u => (IVY_UNIVERSITY_SLUGS as readonly string[]).includes(u.slug)).map(u => u.id);

  const uniSlug = intent?.target_uni_slug;
  const uniId = uniSlug ? unis.find(u => u.slug === uniSlug)?.id : undefined;
  const uniRow = uniId ? unis.find(u => u.id === uniId) : undefined;
  const ivyOnly = intent?.ivy_league && !uniId;
  const state = intent?.state ?? undefined;
  const region = intent?.region ?? undefined;

  let structuredIds: string[] | undefined;
  if (!uniId) {
    if (ivyOnly) structuredIds = ivyIds;
    else if (state) structuredIds = unis.filter(u => u.state === state).map(u => u.id);
    else if (region) structuredIds = unis.filter(u => u.region === region).map(u => u.id);
  }

  const where: any[] = [eq(collegeApplications.status, "approved")];
  if (uniId) where.push(eq(collegeApplications.universityId, uniId));
  else if (structuredIds && structuredIds.length > 0) where.push(inArray(collegeApplications.universityId, structuredIds));

  const filterTokens = buildFilterTokens({
    uniName: uniRow?.name,
    uniSlug: uniRow?.slug,
    uniAliases: uniRow?.aliases ?? undefined,
    ivy: ivyOnly,
    state: !uniId ? state : undefined,
    region: !uniId ? region : undefined,
  });

  const phrases = [
    ...(intent?.themes ?? []),
    ...(intent?.activities ?? []),
    intent?.major ?? "",
    q,
  ].filter(Boolean);
  const tokens = expandSearchTokens(phrases, filterTokens);
  const tc = buildTextMatchCondition(tokens);
  if (tc) where.push(tc);

  const rows = await db.query.collegeApplications.findMany({
    where: and(...where),
    with: { university: { columns: { slug: true } } },
    limit: 20,
  });

  console.log(`\n── "${q}"`);
  console.log(`   intent: uni=${uniSlug ?? "-"} ivy=${!!ivyOnly} state=${state ?? "-"} region=${region ?? "-"} themes=[${(intent?.themes ?? []).join(",")}] activities=[${(intent?.activities ?? []).join(",")}] major=${intent?.major ?? "-"}`);
  console.log(`   filterTokens: {${Array.from(filterTokens).join(",")}}`);
  console.log(`   search tokens: [${tokens.join(" | ")}]`);
  console.log(`   rows: ${rows.length} → ${rows.slice(0, 5).map(r => r.university?.slug).join(", ")}${rows.length > 5 ? ", ..." : ""}`);
}

async function main() {
  const queries = [
    "penn", "upenn", "ivy", "ivy league",
    "cs", "computer science", "bio", "econ", "stem", "ai", "ml",
    "math", "mathematics", "robotics", "debate",
    "first gen", "leadership", "entrepreneurship",
    "california schools", "new england",
    "penn debate", "mit ai",
    "premed", "ppe", "political science", "quantitative finance",
    "public health", "environmental",
  ];
  for (const q of queries) {
    try { await runQuery(q); } catch (e) { console.error(q, e); }
    await new Promise(r => setTimeout(r, 400));
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
