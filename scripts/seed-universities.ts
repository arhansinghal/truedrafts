/**
 * Run with: npm run db:seed
 * Seeds the universities table with top US universities including
 * location metadata and searchable aliases.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { config } from "dotenv";
config({ path: ".env.local" });

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

const UNIVERSITIES: Array<{
  name: string;
  slug: string;
  country: string;
  displayOrder: number;
  state: string;
  city: string;
  region: string;
  type: string;
  aliases: string[];
}> = [
  {
    name: "Harvard University", slug: "harvard", country: "US", displayOrder: 1,
    state: "MA", city: "Cambridge", region: "northeast", type: "ivy",
    aliases: ["harvard", "crimson", "h-bomb", "the crimson", "harvard university"],
  },
  {
    name: "MIT", slug: "mit", country: "US", displayOrder: 2,
    state: "MA", city: "Cambridge", region: "northeast", type: "private_research",
    aliases: ["mit", "massachusetts institute of technology", "m.i.t."],
  },
  {
    name: "Stanford University", slug: "stanford", country: "US", displayOrder: 3,
    state: "CA", city: "Stanford", region: "west", type: "private_research",
    aliases: ["stanford", "the farm", "cardinal", "leland stanford", "stanford university"],
  },
  {
    name: "Yale University", slug: "yale", country: "US", displayOrder: 4,
    state: "CT", city: "New Haven", region: "northeast", type: "ivy",
    aliases: ["yale", "elis", "bulldogs", "yale university"],
  },
  {
    name: "Princeton University", slug: "princeton", country: "US", displayOrder: 5,
    state: "NJ", city: "Princeton", region: "northeast", type: "ivy",
    aliases: ["princeton", "tiger", "tigers", "princeton university"],
  },
  {
    name: "Columbia University", slug: "columbia", country: "US", displayOrder: 6,
    state: "NY", city: "New York", region: "northeast", type: "ivy",
    aliases: ["columbia", "columbia university", "lions"],
  },
  {
    name: "University of Pennsylvania", slug: "upenn", country: "US", displayOrder: 7,
    state: "PA", city: "Philadelphia", region: "northeast", type: "ivy",
    aliases: ["upenn", "penn", "u penn", "u of p", "wharton", "quakers", "university of pennsylvania"],
  },
  {
    name: "Brown University", slug: "brown", country: "US", displayOrder: 8,
    state: "RI", city: "Providence", region: "northeast", type: "ivy",
    aliases: ["brown", "brown university", "brown bears"],
  },
  {
    name: "Dartmouth College", slug: "dartmouth", country: "US", displayOrder: 9,
    state: "NH", city: "Hanover", region: "northeast", type: "ivy",
    aliases: ["dartmouth", "dartmouth college", "big green"],
  },
  {
    name: "Cornell University", slug: "cornell", country: "US", displayOrder: 10,
    state: "NY", city: "Ithaca", region: "northeast", type: "ivy",
    aliases: ["cornell", "cornell university", "big red"],
  },
  {
    name: "Duke University", slug: "duke", country: "US", displayOrder: 11,
    state: "NC", city: "Durham", region: "south", type: "private_research",
    aliases: ["duke", "duke university", "blue devils"],
  },
  {
    name: "Johns Hopkins University", slug: "jhu", country: "US", displayOrder: 12,
    state: "MD", city: "Baltimore", region: "mid_atlantic", type: "private_research",
    aliases: ["jhu", "johns hopkins", "johns hopkins university", "hopkins", "j hop", "blue jays"],
  },
  {
    name: "Northwestern University", slug: "northwestern", country: "US", displayOrder: 13,
    state: "IL", city: "Evanston", region: "midwest", type: "private_research",
    aliases: ["northwestern", "northwestern university", "wildcats", "nu northwestern"],
  },
  {
    name: "Vanderbilt University", slug: "vanderbilt", country: "US", displayOrder: 14,
    state: "TN", city: "Nashville", region: "south", type: "private_research",
    aliases: ["vanderbilt", "vandy", "vanderbilt university", "commodores"],
  },
  {
    name: "Rice University", slug: "rice", country: "US", displayOrder: 15,
    state: "TX", city: "Houston", region: "south", type: "private_research",
    aliases: ["rice", "rice university", "owls"],
  },
  {
    name: "Washington University in St. Louis", slug: "washu", country: "US", displayOrder: 16,
    state: "MO", city: "St. Louis", region: "midwest", type: "private_research",
    aliases: ["washu", "wustl", "wash u", "washington university", "washington u", "washington university in st. louis"],
  },
  {
    name: "Notre Dame", slug: "notre-dame", country: "US", displayOrder: 17,
    state: "IN", city: "Notre Dame", region: "midwest", type: "private_research",
    aliases: ["notre dame", "notre-dame", "nd", "und", "fighting irish", "irish", "university of notre dame"],
  },
  {
    name: "Georgetown University", slug: "georgetown", country: "US", displayOrder: 18,
    state: "DC", city: "Washington", region: "mid_atlantic", type: "private_research",
    aliases: ["georgetown", "georgetown university", "gtown", "hoyas", "g-town"],
  },
  {
    name: "Emory University", slug: "emory", country: "US", displayOrder: 19,
    state: "GA", city: "Atlanta", region: "south", type: "private_research",
    aliases: ["emory", "emory university", "eagles emory"],
  },
  {
    name: "Carnegie Mellon University", slug: "cmu", country: "US", displayOrder: 20,
    state: "PA", city: "Pittsburgh", region: "northeast", type: "private_research",
    aliases: ["cmu", "carnegie mellon", "carnegie mellon university", "carnegie-mellon", "tartans"],
  },
  {
    name: "University of Michigan", slug: "umich", country: "US", displayOrder: 21,
    state: "MI", city: "Ann Arbor", region: "midwest", type: "public_flagship",
    aliases: ["umich", "michigan", "u-m", "u of m", "wolverines", "university of michigan"],
  },
  {
    name: "UC Berkeley", slug: "uc-berkeley", country: "US", displayOrder: 22,
    state: "CA", city: "Berkeley", region: "west", type: "public_flagship",
    aliases: ["uc berkeley", "uc-berkeley", "berkeley", "cal", "ucb", "golden bears", "university of california berkeley"],
  },
  {
    name: "UCLA", slug: "ucla", country: "US", displayOrder: 23,
    state: "CA", city: "Los Angeles", region: "west", type: "public_flagship",
    aliases: ["ucla", "bruins", "westwood", "uc los angeles", "university of california los angeles"],
  },
  {
    name: "University of Virginia", slug: "uva", country: "US", displayOrder: 24,
    state: "VA", city: "Charlottesville", region: "south", type: "public_flagship",
    aliases: ["uva", "university of virginia", "wahoos", "hoos", "cavaliers"],
  },
  {
    name: "University of North Carolina", slug: "unc", country: "US", displayOrder: 25,
    state: "NC", city: "Chapel Hill", region: "south", type: "public_flagship",
    aliases: ["unc", "unc chapel hill", "chapel hill", "tar heels", "university of north carolina"],
  },
  {
    name: "University of Southern California", slug: "usc", country: "US", displayOrder: 26,
    state: "CA", city: "Los Angeles", region: "west", type: "private_research",
    aliases: ["usc", "southern cal", "trojans", "university of southern california"],
  },
  {
    name: "New York University", slug: "nyu", country: "US", displayOrder: 27,
    state: "NY", city: "New York", region: "northeast", type: "private_research",
    aliases: ["nyu", "new york university", "violets"],
  },
  {
    name: "Boston College", slug: "boston-college", country: "US", displayOrder: 28,
    state: "MA", city: "Chestnut Hill", region: "northeast", type: "private_research",
    aliases: ["boston college", "boston-college", "bc", "the heights", "bc eagles"],
  },
  {
    name: "Tufts University", slug: "tufts", country: "US", displayOrder: 29,
    state: "MA", city: "Medford", region: "northeast", type: "private_research",
    aliases: ["tufts", "tufts university", "jumbos", "jumbo"],
  },
  {
    name: "Wellesley College", slug: "wellesley", country: "US", displayOrder: 30,
    state: "MA", city: "Wellesley", region: "northeast", type: "liberal_arts",
    aliases: ["wellesley", "wellesley college"],
  },
  {
    name: "California Institute of Technology", slug: "caltech", country: "US", displayOrder: 31,
    state: "CA", city: "Pasadena", region: "west", type: "private_research",
    aliases: ["caltech", "cal tech", "california institute of technology", "beavers", "techers"],
  },
];

async function main() {
  console.log("Seeding universities...");
  for (const uni of UNIVERSITIES) {
    await db
      .insert(schema.universities)
      .values(uni)
      .onConflictDoUpdate({
        target: schema.universities.slug,
        set: {
          name: uni.name,
          displayOrder: uni.displayOrder,
          state: uni.state,
          city: uni.city,
          region: uni.region,
          type: uni.type,
          aliases: uni.aliases,
        },
      });
    console.log(`  ✓ ${uni.name} (${uni.state} · ${uni.type})`);
  }
  console.log(`\nDone! Seeded ${UNIVERSITIES.length} universities.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
