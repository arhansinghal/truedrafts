import { db, essays } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";

// Simple in-memory rate limit: one view per IP per essay per 30 min
const viewCache = new Map<string, number>();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const key = `${ip}:${id}`;
  const now = Date.now();
  const last = viewCache.get(key) ?? 0;

  // Rate limit: 30 minutes per IP per essay
  if (now - last < 30 * 60 * 1000) {
    return Response.json({ ok: true, skipped: true });
  }

  viewCache.set(key, now);

  // Clean cache periodically
  if (viewCache.size > 10000) {
    const cutoff = now - 30 * 60 * 1000;
    for (const [k, v] of viewCache.entries()) {
      if (v < cutoff) viewCache.delete(k);
    }
  }

  await db
    .update(essays)
    .set({ views: sql`${essays.views} + 1` })
    .where(eq(essays.id, id))
    .catch(() => {});

  return Response.json({ ok: true });
}
