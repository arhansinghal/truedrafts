import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// Use the global WebSocket available in Node 18+ and all browsers
neonConfig.webSocketConstructor = globalThis.WebSocket;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle(pool, { schema });

export * from "./schema";
