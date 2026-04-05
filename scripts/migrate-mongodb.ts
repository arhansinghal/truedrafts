/**
 * One-time migration: MongoDB (test db) → Neon PostgreSQL
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/migrate-mongodb.ts
 */

import { MongoClient } from "mongodb";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import * as dotenv from "dotenv";
import { nanoid } from "nanoid";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const MONGO_URI =
  "mongodb+srv://truedrafts1:nikSING201202@truedrafts-core.becjekn.mongodb.net/?appName=truedrafts-core";

// Map old university name → slug used in our universities table
const UNI_NAME_TO_SLUG: Record<string, string> = {
  "Harvard University": "harvard",
  "Massachusetts Institute of Technology": "mit",
  "Stanford University": "stanford",
  "Yale University": "yale",
  "Princeton University": "princeton",
  "Columbia University": "columbia",
  "University of Pennsylvania": "upenn",
  "Brown University": "brown",
  "Dartmouth College": "dartmouth",
  "Cornell University": "cornell",
  "Duke University": "duke",
  "Northwestern University": "northwestern",
  "Johns Hopkins University": "jhu",
  "Vanderbilt University": "vanderbilt",
  "Rice University": "rice",
  "Washington University in St. Louis": "washu",
  "Emory University": "emory",
  "University of Notre Dame": "notre-dame",
  "Georgetown University": "georgetown",
  "University of California, Berkeley": "uc-berkeley",
  "University of California, Los Angeles": "ucla",
  "University of Michigan": "umich",
  "University of Virginia": "uva",
  "University of North Carolina at Chapel Hill": "unc",
  "University of Southern California": "usc",
  "New York University": "nyu",
  "Tufts University": "tufts",
  "Boston College": "boston-college",
  "Carnegie Mellon University": "cmu",
  "Wellesley College": "wellesley",
  "Georgia Institute of Technology": "georgia-tech",
  "University of Illinois at Urbana-Champaign": "uiuc",
  "University of Illinois, Urbana-Champaign": "uiuc",
  "University of California, San Diego": "ucsd",
  "University of California, Santa Barbara": "ucsb",
  "University of California, Irvine": "uci",
  "Purdue University": "purdue",
  "University of Chicago": "uchicago",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function priceToCents(price: number | undefined): number {
  if (!price) return 1999;
  return Math.round(price * 100);
}

async function main() {
  console.log("Connecting to MongoDB...");
  const mongo = new MongoClient(MONGO_URI, {
    tlsAllowInvalidCertificates: true,
    tlsAllowInvalidHostnames: true,
  });
  await mongo.connect();
  const mongoDb = mongo.db("test");

  // ── 1. Load all universities from Postgres ──────────────────────────────────
  console.log("\n[1/4] Loading universities from Postgres...");
  const existingUnis = await db.query.universities.findMany();
  const uniBySlug = new Map(existingUnis.map((u) => [u.slug, u]));
  console.log(`Found ${existingUnis.length} universities in Postgres.`);

  // ── 2. Migrate users ────────────────────────────────────────────────────────
  console.log("\n[2/4] Migrating users...");
  const mongoUsers = await mongoDb.collection("users").find().toArray();
  console.log(`Found ${mongoUsers.length} users in MongoDB.`);

  const userIdMap = new Map<string, string>(); // mongo _id → postgres id

  let usersInserted = 0;
  let usersSkipped = 0;

  for (const mu of mongoUsers) {
    const mongoId = mu._id.toString();
    const email = mu.email as string;
    if (!email) { usersSkipped++; continue; }

    // Check if user already exists in Postgres
    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, email),
    });

    if (existing) {
      userIdMap.set(mongoId, existing.id);
      // Also map firebaseId if present
      if (mu.firebaseId) userIdMap.set(mu.firebaseId as string, existing.id);
      usersSkipped++;
      continue;
    }

    const role: "reader" | "writer" | "admin" =
      mu.user_type === "writer" ? "writer" :
      mu.user_type === "admin" ? "admin" : "reader";

    const newId = nanoid();
    userIdMap.set(mongoId, newId);
    if (mu.firebaseId) userIdMap.set(mu.firebaseId as string, newId);

    await db.insert(schema.users).values({
      id: newId,
      email,
      name: (mu.name as string) || email.split("@")[0],
      emailVerified: true,
      image: (mu.profilePicture as string) ?? null,
      role,
      bio: (mu.bio as string) ?? null,
      graduationYear: mu.graduationYear ? parseInt(mu.graduationYear as string) : null,
      createdAt: mu.createdAt ? new Date(mu.createdAt as string) : new Date(),
      updatedAt: mu.updatedAt ? new Date(mu.updatedAt as string) : new Date(),
    }).onConflictDoNothing();

    usersInserted++;
    process.stdout.write(`  Inserted user: ${email}\n`);
  }

  console.log(`Users: ${usersInserted} inserted, ${usersSkipped} skipped (already exist).`);

  // ── 3. Migrate essays → college_applications ────────────────────────────────
  console.log("\n[3/4] Migrating essays → college_applications...");
  const mongoEssays = await mongoDb.collection("essays").find().toArray();
  console.log(`Found ${mongoEssays.length} essays in MongoDB.`);

  let essaysInserted = 0;
  let essaysSkipped = 0;
  const missingUnis: string[] = [];
  const missingUsers: string[] = [];

  for (const me of mongoEssays) {
    const mongoEssayId = me._id.toString();

    // Resolve university
    const uniName = me.university as string;
    const uniSlug = UNI_NAME_TO_SLUG[uniName];
    if (!uniSlug) {
      console.warn(`  SKIP essay ${mongoEssayId}: unknown university "${uniName}"`);
      missingUnis.push(uniName);
      essaysSkipped++;
      continue;
    }
    const uni = uniBySlug.get(uniSlug);
    if (!uni) {
      console.warn(`  SKIP essay ${mongoEssayId}: university "${uniSlug}" not in Postgres`);
      essaysSkipped++;
      continue;
    }

    // Resolve writer
    const firebaseId = me.userId as string;
    const writerId = userIdMap.get(firebaseId);
    if (!writerId) {
      console.warn(`  SKIP essay ${mongoEssayId}: writer firebaseId "${firebaseId}" not found`);
      missingUsers.push(firebaseId);
      essaysSkipped++;
      continue;
    }

    // Check if already migrated (by slug)
    const baseSlug = slugify(`${uniName} ${me.major ?? ""} ${mongoEssayId.slice(-6)}`);
    const existing = await db.query.collegeApplications.findFirst({
      where: eq(schema.collegeApplications.slug, baseSlug),
    });
    if (existing) { essaysSkipped++; continue; }

    // Build supplementals JSON
    const supplementals = ((me.supplementalEssays as any[]) ?? []).map((s: any) => ({
      prompt: s.prompt ?? "",
      content: s.text ?? "",
      screenshotUrl: s.screenshotUrl ?? null,
    }));

    const commonApp = me.commonAppEssay as any;
    const title = `${uniName} — ${me.major ?? "Application"}`;
    const status = me.status === "approved" ? "approved" : me.status === "rejected" ? "rejected" : "pending";

    await db.insert(schema.collegeApplications).values({
      writerId,
      universityId: uni.id,
      title,
      slug: baseSlug,
      admittedYear: me.admittedYear ? parseInt(me.admittedYear as string) : null,
      priceCents: priceToCents(me.price as number),
      status: status as "approved" | "pending" | "rejected",
      admissionProofUrl: (me.acceptanceLetter as any)?.url ?? null,
      submittedCommonApp: !!(me.hasCommonAppEssay && commonApp?.text),
      commonAppContent: commonApp?.text ?? null,
      commonAppScreenshotUrl: commonApp?.screenshotUrl ?? null,
      supplementals: JSON.stringify(supplementals),
      numSupplementals: supplementals.length,
      tags: (me.tags as string[]) ?? [],
      views: (me.views as number) ?? 0,
      purchases: (me.purchases as number) ?? 0,
      createdAt: me.createdAt ? new Date(me.createdAt as string) : new Date(),
      publishedAt: me.status === "approved" && me.reviewedAt
        ? new Date(me.reviewedAt as string)
        : null,
    }).onConflictDoNothing();

    essaysInserted++;
    process.stdout.write(`  Inserted: ${title}\n`);
  }

  console.log(`Essays: ${essaysInserted} inserted, ${essaysSkipped} skipped.`);
  if (missingUnis.length) {
    const unique = [...new Set(missingUnis)];
    console.warn(`\nUnknown universities (add to UNI_NAME_TO_SLUG map if needed):\n  ${unique.join("\n  ")}`);
  }
  if (missingUsers.length) {
    console.warn(`\nMissing writers (${missingUsers.length} essays skipped due to no matching user)`);
  }

  // ── 4. Done ─────────────────────────────────────────────────────────────────
  console.log("\n[4/4] Migration complete!");
  await mongo.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
