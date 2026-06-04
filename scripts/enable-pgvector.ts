// Enables the pgvector extension on Neon. Idempotent. Run before db:push when
// adding vector columns for the first time.
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  // Try .env.local
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
}

if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const client = await pool.connect();
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("pgvector extension enabled");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
