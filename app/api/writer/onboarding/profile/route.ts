import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";

const MAX_BODY_BYTES = 100_000;

// Reads and parses the JSON body while refusing to buffer more than
// MAX_BODY_BYTES, so a chunked request cannot force unbounded allocation.
async function readJsonLimited(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new SyntaxError("Empty body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      const err = new Error("Payload too large") as Error & { tooLarge?: boolean };
      err.tooLarge = true;
      throw err;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(buf));
}

// Saves writer onboarding profile fields. Accepts any subset of
// { name, country, bio, activities } and only updates what's provided, so the
// wizard can save name+country up front and bio+activities at the end.
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await readJsonLimited(req);
  } catch (e) {
    if ((e as { tooLarge?: boolean } | null)?.tooLarge) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { name, country, bio, activities } = (body ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) updates.name = name.trim();
  if (typeof country === "string") updates.country = country.trim() || null;
  if (typeof bio === "string") updates.bio = bio.trim() || null;
  if (Array.isArray(activities)) {
    const cleaned = activities
      .filter((a) => a && typeof a.name === "string" && a.name.trim())
      .map((a) => ({ name: String(a.name).trim(), description: String(a.description ?? "").trim() }));
    updates.activities = JSON.stringify(cleaned);
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ ok: true });
  }

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
