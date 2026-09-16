import { auth } from "@/lib/auth";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import { readJsonBounded } from "@/lib/request-limits";

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await readJsonBounded(req);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
  // `parsed.value` is whatever JSON the client sent — it may be null, a
  // primitive or an array, so every field is type-checked before use rather
  // than optional-chained. `null.name` and `(123).trim()` both throw, and an
  // unhandled throw here is a 500.
  const body = (parsed.value ?? {}) as Record<string, unknown>;

  // null or "" clears the field; a string is trimmed; anything else is left
  // alone. Ignoring a wrong-typed value matters: coercing it would silently
  // wipe a writer's bio because the client sent the wrong shape.
  const textField = (v: unknown): string | null | undefined => {
    if (v === null) return null;
    if (typeof v === "string") return v.trim() || null;
    return undefined;
  };
  const jsonArrayField = (v: unknown): string | undefined => {
    if (v === null) return "[]";
    if (Array.isArray(v)) return JSON.stringify(v);
    return undefined;
  };

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  for (const [key, value] of [
    ["bio", textField(body.bio)],
    ["country", textField(body.country)],
    ["activities", jsonArrayField(body.activities)],
    ["honors", jsonArrayField(body.honors)],
  ] as const) {
    if (value !== undefined) updates[key] = value;
  }

  if (Object.keys(updates).length === 0) return Response.json({ error: "Nothing to update" }, { status: 400 });

  await db.update(users).set(updates).where(eq(users.id, session.user.id));
  return Response.json({ ok: true });
}
