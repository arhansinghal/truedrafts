/**
 * One-off: ensure a given user is an admin.
 * Run with: NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/set-admin.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { config } from "dotenv";
config({ path: ".env.local" });

const EMAIL = "arhansinghal2811@gmail.com";

const db = drizzle(neon(process.env.DATABASE_URL!), { schema });

async function main() {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, EMAIL),
    columns: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    console.log(`❌ No user found with email ${EMAIL}`);
    return;
  }

  console.log("Before:", user);

  if (user.role === "admin") {
    console.log("✓ Already an admin — no change needed.");
    return;
  }

  await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, user.id));

  const after = await db.query.users.findFirst({
    where: eq(schema.users.id, user.id),
    columns: { id: true, email: true, name: true, role: true },
  });
  console.log("After: ", after);
  console.log("✓ Role updated to admin.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
