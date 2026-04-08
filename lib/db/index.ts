import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Use native WebSocket (Node 21+/browsers) or fall back to the `ws` package
if (typeof globalThis.WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export * from "./schema";
