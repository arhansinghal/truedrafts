/**
 * Run with: npx tsx scripts/seed-universities.ts
 * Seeds the universities table with top US universities.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
config({ path: ".env.local" });

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

const UNIVERSITIES = [
  { name: "Harvard University", slug: "harvard", country: "US", displayOrder: 1 },
  { name: "MIT", slug: "mit", country: "US", displayOrder: 2 },
  { name: "Stanford University", slug: "stanford", country: "US", displayOrder: 3 },
  { name: "Yale University", slug: "yale", country: "US", displayOrder: 4 },
  { name: "Princeton University", slug: "princeton", country: "US", displayOrder: 5 },
  { name: "Columbia University", slug: "columbia", country: "US", displayOrder: 6 },
  { name: "University of Pennsylvania", slug: "upenn", country: "US", displayOrder: 7 },
  { name: "Brown University", slug: "brown", country: "US", displayOrder: 8 },
  { name: "Dartmouth College", slug: "dartmouth", country: "US", displayOrder: 9 },
  { name: "Cornell University", slug: "cornell", country: "US", displayOrder: 10 },
  { name: "Duke University", slug: "duke", country: "US", displayOrder: 11 },
  { name: "Johns Hopkins University", slug: "jhu", country: "US", displayOrder: 12 },
  { name: "Northwestern University", slug: "northwestern", country: "US", displayOrder: 13 },
  { name: "Vanderbilt University", slug: "vanderbilt", country: "US", displayOrder: 14 },
  { name: "Rice University", slug: "rice", country: "US", displayOrder: 15 },
  { name: "Washington University in St. Louis", slug: "washu", country: "US", displayOrder: 16 },
  { name: "Notre Dame", slug: "notre-dame", country: "US", displayOrder: 17 },
  { name: "Georgetown University", slug: "georgetown", country: "US", displayOrder: 18 },
  { name: "Emory University", slug: "emory", country: "US", displayOrder: 19 },
  { name: "Carnegie Mellon University", slug: "cmu", country: "US", displayOrder: 20 },
  { name: "University of Michigan", slug: "umich", country: "US", displayOrder: 21 },
  { name: "UC Berkeley", slug: "uc-berkeley", country: "US", displayOrder: 22 },
  { name: "UCLA", slug: "ucla", country: "US", displayOrder: 23 },
  { name: "University of Virginia", slug: "uva", country: "US", displayOrder: 24 },
  { name: "University of North Carolina", slug: "unc", country: "US", displayOrder: 25 },
  { name: "University of Southern California", slug: "usc", country: "US", displayOrder: 26 },
  { name: "New York University", slug: "nyu", country: "US", displayOrder: 27 },
  { name: "Boston College", slug: "boston-college", country: "US", displayOrder: 28 },
  { name: "Tufts University", slug: "tufts", country: "US", displayOrder: 29 },
  { name: "Wellesley College", slug: "wellesley", country: "US", displayOrder: 30 },
];
1
async function main() {
  console.log("Seeding universities...");
  for (const uni of UNIVERSITIES) {
    await db
      .insert(schema.universities)
      .values(uni)
      .onConflictDoUpdate({
        target: schema.universities.slug,
        set: { name: uni.name, displayOrder: uni.displayOrder },
      });
    console.log(`  ✓ ${uni.name}`);
  }
  console.log(`Done! Seeded ${UNIVERSITIES.length} universities.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
