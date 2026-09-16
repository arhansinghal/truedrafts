/**
 * Regression tests for the concurrent email rate-limit race.
 *
 * The bug: sendForgotPasswordEmail counted email_logs rows in the window, then
 * rendered + sent through Resend, and only afterwards inserted its own row.
 * Two requests for the same address could both read count = 2, both pass the
 * "< 3" test, and both send — 4 reset emails against a documented max of 3.
 * sendWelcomeEmail had the identical shape with a cap of 1.
 *
 * These tests drive the real exported functions against an in-memory Postgres
 * model that deliberately reproduces the properties the race depends on:
 *
 *   - every query costs a real macrotask turn, so two concurrent invocations
 *     genuinely interleave rather than running to completion one at a time;
 *   - READ COMMITTED visibility: rows written inside a transaction are invisible
 *     to other transactions until COMMIT. So merely wrapping the count+insert
 *     in a transaction does NOT fix anything here — only real serialization does;
 *   - pg_advisory_xact_lock is modelled as a keyed mutex released at
 *     COMMIT/ROLLBACK, which is exactly its Postgres semantics.
 *
 * Verified to fail against the pre-fix lib/email.tsx (4 sends / 4 rows).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { emailLogs } from "../db/schema";

// ---------------------------------------------------------------------------
// Minimal Postgres model
// ---------------------------------------------------------------------------

/** Simulated round-trip for every statement. Non-zero so calls really overlap. */
const LATENCY_MS = 4;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Row = {
  id: string;
  recipientEmail: string;
  subject: string;
  type: string;
  status: string;
  resendId?: string | null;
  metadata?: string | null;
  error?: string | null;
  sentAt: Date;
};

/** db column name -> drizzle property name, e.g. "recipient_email" -> "recipientEmail". */
const COLUMN_TO_KEY = new Map<string, string>(
  Object.entries(getTableColumns(emailLogs)).map(([key, col]) => [
    (col as unknown as { name: string }).name,
    key,
  ]),
);

type Token = { k: "s"; v: string } | { k: "c"; v: string } | { k: "p"; v: unknown };

/** Flatten a drizzle SQL tree into strings / columns / bound params. */
function flatten(node: unknown, out: Token[] = []): Token[] {
  const chunks = (node as { queryChunks?: unknown[] })?.queryChunks ?? [];
  for (const ch of chunks) {
    if (ch == null) continue;
    if (typeof ch === "string") {
      out.push({ k: "s", v: ch });
    } else if (typeof ch !== "object") {
      // Raw interpolations in a sql`` template arrive unwrapped (numbers etc.).
      out.push({ k: "p", v: ch });
    } else if (ch instanceof Date) {
      out.push({ k: "p", v: ch });
    } else if (Array.isArray((ch as { queryChunks?: unknown[] }).queryChunks)) {
      flatten(ch, out);
    } else if (typeof (ch as { name?: unknown }).name === "string") {
      out.push({ k: "c", v: (ch as { name: string }).name }); // Column
    } else if ("encoder" in (ch as object)) {
      out.push({ k: "p", v: (ch as { value: unknown }).value }); // Param
    } else if (Array.isArray((ch as { value?: unknown }).value)) {
      out.push({ k: "s", v: ((ch as { value: string[] }).value).join("") }); // StringChunk
    }
  }
  return out;
}

const OPERATORS = new Set(["=", ">=", "<=", ">", "<", "<>", "!="]);

/** Parse an `and(...)` of simple column/op/param comparisons. */
function predicatesOf(cond: unknown) {
  const toks = flatten(cond);
  const text = toks.filter((t) => t.k === "s").map((t) => t.v).join(" ").toLowerCase();
  // The code under test only builds conjunctions; fail loudly rather than
  // silently mis-modelling anything else.
  if (/\bor\b/.test(text)) throw new Error("fake db: OR conditions are not modelled");

  const preds: { col: string; op: string; val: unknown }[] = [];
  let col: string | null = null;
  let op: string | null = null;
  for (const t of toks) {
    if (t.k === "c") {
      col = t.v;
      op = null;
    } else if (t.k === "s") {
      const s = t.v.trim();
      if (OPERATORS.has(s)) op = s;
    } else if (t.k === "p") {
      if (col && op) preds.push({ col, op, val: t.v });
      col = null;
      op = null;
    }
  }
  if (preds.length === 0) throw new Error("fake db: could not parse condition");
  return preds;
}

function matches(row: Row, cond: unknown): boolean {
  for (const p of predicatesOf(cond)) {
    const key = COLUMN_TO_KEY.get(p.col);
    if (!key) throw new Error(`fake db: unknown column ${p.col}`);
    const raw = (row as unknown as Record<string, unknown>)[key];
    const a = raw instanceof Date ? raw.getTime() : raw;
    const b = p.val instanceof Date ? p.val.getTime() : p.val;
    const ok =
      p.op === "=" ? a === b
      : p.op === "<>" || p.op === "!=" ? a !== b
      : p.op === ">=" ? (a as number) >= (b as number)
      : p.op === "<=" ? (a as number) <= (b as number)
      : p.op === ">" ? (a as number) > (b as number)
      : (a as number) < (b as number);
    if (!ok) return false;
  }
  return true;
}

type TxCtx = { pending: Row[] | null; releases: (() => void)[] };

class FakePostgres {
  committed: Row[] = [];
  /** Ordered trace of every statement, for asserting the interleaving. */
  ops: string[] = [];
  private lockTails = new Map<string, Promise<void>>();
  private rootCtx: TxCtx = { pending: null, releases: [] };

  reset() {
    this.committed = [];
    this.ops = [];
    this.lockTails.clear();
    this.rootCtx = { pending: null, releases: [] };
  }

  seed(rows: Array<Partial<Row> & { recipientEmail: string; type: string }>) {
    for (const r of rows) {
      this.committed.push({
        id: randomUUID(),
        subject: "seeded",
        status: "sent",
        metadata: "{}",
        sentAt: new Date(),
        ...r,
      } as Row);
    }
  }

  rowsFor(email: string, type: string) {
    return this.committed.filter((r) => r.recipientEmail === email && r.type === type);
  }

  /** Keyed mutex. Resolves to the release fn once the lock is held. */
  private async acquire(key: string): Promise<() => void> {
    const prev = this.lockTails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => { release = r; });
    this.lockTails.set(key, prev.then(() => mine));
    await prev;
    return release;
  }

  private async doInsert(ctx: TxCtx, values: Partial<Row>) {
    await sleep(LATENCY_MS);
    const row: Row = {
      id: randomUUID(),
      subject: "",
      status: "sent",
      metadata: "{}",
      resendId: null,
      error: null,
      sentAt: new Date(), // defaultNow()
      ...values,
    } as Row;
    (ctx.pending ?? this.committed).push(row);
    this.ops.push(`insert ${row.type} ${row.status}`);
    return [{ id: row.id }];
  }

  private async doUpdate(ctx: TxCtx, patch: Partial<Row>, cond: unknown) {
    await sleep(LATENCY_MS);
    const visible = ctx.pending ? [...this.committed, ...ctx.pending] : this.committed;
    for (const r of visible) if (matches(r, cond)) Object.assign(r, patch);
    this.ops.push(`update ${patch.status}`);
  }

  private api(ctx: TxCtx) {
    const self = this;
    const lazy = <T>(run: () => Promise<T>) => {
      let p: Promise<T> | null = null;
      const get = () => (p ??= run());
      return {
        then: (a?: never, b?: never) => get().then(a, b),
        catch: (a?: never) => get().catch(a),
        finally: (a?: never) => get().finally(a),
      };
    };

    return {
      query: {},

      select(fields: Record<string, unknown>) {
        const key = Object.keys(fields)[0];
        return {
          from: () => ({
            where: async (cond: unknown) => {
              await sleep(LATENCY_MS);
              const visible = ctx.pending ? [...self.committed, ...ctx.pending] : self.committed;
              const n = visible.filter((r) => matches(r, cond)).length;
              self.ops.push(`count -> ${n}`);
              return [{ [key]: n }];
            },
          }),
        };
      },

      insert() {
        return {
          values: (values: Partial<Row>) => {
            let p: Promise<{ id: string }[]> | null = null;
            const run = () => (p ??= self.doInsert(ctx, values));
            return {
              returning: () => lazy(run),
              then: (a?: never, b?: never) => run().then(a, b),
              catch: (a?: never) => run().catch(a),
              finally: (a?: never) => run().finally(a),
            };
          },
        };
      },

      update() {
        return {
          set: (patch: Partial<Row>) => ({
            where: (cond: unknown) => lazy(() => self.doUpdate(ctx, patch, cond)),
          }),
        };
      },

      execute: async (statement: unknown) => {
        const toks = flatten(statement);
        const text = toks.filter((t) => t.k === "s").map((t) => t.v).join("");
        if (text.includes("pg_advisory_xact_lock")) {
          if (!ctx.pending) {
            throw new Error(
              "fake db: pg_advisory_xact_lock outside a transaction is released immediately and guards nothing",
            );
          }
          const key = toks.filter((t) => t.k === "p").map((t) => String(t.v)).join(":");
          self.ops.push(`lock-wait ${key}`);
          const release = await self.acquire(key);
          self.ops.push(`lock-held ${key}`);
          ctx.releases.push(release);
          return { rows: [] };
        }
        await sleep(LATENCY_MS);
        return { rows: [] };
      },

      transaction: <T,>(fn: (tx: unknown) => Promise<T>) => self.transaction(fn),
    };
  }

  async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const ctx: TxCtx = { pending: [], releases: [] };
    this.ops.push("begin");
    try {
      const result = await fn(this.api(ctx));
      await sleep(LATENCY_MS); // COMMIT round-trip
      this.committed.push(...(ctx.pending ?? []));
      this.ops.push("commit");
      return result;
    } catch (e) {
      this.ops.push("rollback");
      throw e;
    } finally {
      // Transaction-scoped advisory locks drop at COMMIT/ROLLBACK, never before.
      for (const release of ctx.releases.reverse()) release();
    }
  }

  get handle() {
    return this.api(this.rootCtx);
  }
}

const pg = new FakePostgres();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const resendState = {
  sent: [] as Array<{ to: string; subject: string }>,
  sendLatencyMs: 12,
  failNext: 0,
};

vi.mock("../db", async () => {
  const schema = await vi.importActual<typeof import("../db/schema")>("../db/schema");
  return { ...schema, db: pg.handle };
});

vi.mock("resend", () => {
  class Resend {
    emails = {
      send: async (payload: { to: string; subject: string }) => {
        await sleep(resendState.sendLatencyMs);
        if (resendState.failNext > 0) {
          resendState.failNext--;
          throw new Error("resend boom");
        }
        resendState.sent.push({ to: payload.to, subject: payload.subject });
        return { data: { id: `re_${randomUUID()}` }, error: null };
      },
    };
  }
  return { Resend };
});

async function emailModule() {
  return import("../email");
}

const ADDRESS = "racer@example.com";
const WINDOW_MS = 15 * 60 * 1000;

beforeEach(() => {
  pg.reset();
  resendState.sent = [];
  resendState.sendLatencyMs = 12;
  resendState.failNext = 0;
  // Must not contain "xxx" — getResend() treats that as an unset placeholder.
  process.env.RESEND_API_KEY = "re_test_key_0123456789";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The race
// ---------------------------------------------------------------------------

describe("forgot-password rate limit under concurrency", () => {
  it("two requests racing from a count of two produce a third attempt, not a fourth", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    // Two attempts already inside the 15-minute window.
    pg.seed([
      { recipientEmail: ADDRESS, type: "forgot_password", sentAt: new Date(Date.now() - 60_000) },
      { recipientEmail: ADDRESS, type: "forgot_password", sentAt: new Date(Date.now() - 30_000) },
    ]);

    await Promise.all([
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=a"),
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=b"),
    ]);

    // Pre-fix this was 2 sends and 4 rows.
    expect(resendState.sent).toHaveLength(1);
    expect(pg.rowsFor(ADDRESS, "forgot_password")).toHaveLength(3);

    // ...and the two calls really did overlap: the second reservation was
    // waiting on the lock before the first one committed.
    const waits = pg.ops.flatMap((o, i) => (o.startsWith("lock-wait") ? [i] : []));
    const firstCommit = pg.ops.findIndex((o) => o === "commit");
    expect(waits).toHaveLength(2);
    expect(waits[1]).toBeLessThan(firstCommit);
  });

  it("four simultaneous requests from an empty window send exactly three", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    await Promise.all(
      [1, 2, 3, 4].map((i) =>
        sendForgotPasswordEmail(ADDRESS, "Racer", `https://truedrafts.com/reset?token=${i}`),
      ),
    );

    // Pre-fix all four counted 0 and all four sent.
    expect(resendState.sent).toHaveLength(3);
    expect(pg.rowsFor(ADDRESS, "forgot_password")).toHaveLength(3);
  });

  it("a slow provider cannot widen the window — the attempt is recorded before the send", async () => {
    const { sendForgotPasswordEmail } = await emailModule();
    resendState.sendLatencyMs = 80; // dispatch spends ages inside Resend

    await Promise.all([
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=a"),
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=b"),
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=c"),
      sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=d"),
    ]);

    expect(resendState.sent).toHaveLength(3);
    expect(pg.rowsFor(ADDRESS, "forgot_password")).toHaveLength(3);
  });

  it("reservations for different recipients are not serialized behind each other", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    await Promise.all([
      sendForgotPasswordEmail("a@example.com", "A", "https://truedrafts.com/reset?token=a"),
      sendForgotPasswordEmail("b@example.com", "B", "https://truedrafts.com/reset?token=b"),
    ]);

    expect(resendState.sent).toHaveLength(2);
    const lockKeys = new Set(
      pg.ops.filter((o) => o.startsWith("lock-held ")).map((o) => o.slice("lock-held ".length)),
    );
    expect(lockKeys.size).toBe(2);
  });
});

describe("forgot-password rate limit, sequential behaviour is unchanged", () => {
  it("allows three in the window and silently drops the fourth", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    for (let i = 0; i < 4; i++) {
      await sendForgotPasswordEmail(ADDRESS, "Racer", `https://truedrafts.com/reset?token=${i}`);
    }

    expect(resendState.sent).toHaveLength(3);
    expect(pg.rowsFor(ADDRESS, "forgot_password")).toHaveLength(3);
  });

  it("ignores rows outside the window, for other types, and for other addresses", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    pg.seed([
      // Same address + type but older than the 15-minute window.
      { recipientEmail: ADDRESS, type: "forgot_password", sentAt: new Date(Date.now() - WINDOW_MS - 1000) },
      { recipientEmail: ADDRESS, type: "forgot_password", sentAt: new Date(Date.now() - WINDOW_MS - 2000) },
      { recipientEmail: ADDRESS, type: "forgot_password", sentAt: new Date(Date.now() - WINDOW_MS - 3000) },
      // In-window but a different type.
      { recipientEmail: ADDRESS, type: "verify_email" },
      { recipientEmail: ADDRESS, type: "welcome" },
      // In-window, same type, different address.
      { recipientEmail: "someone-else@example.com", type: "forgot_password" },
    ]);

    await sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=x");

    expect(resendState.sent).toHaveLength(1);
  });

  it("a failed provider call still consumes an attempt and is logged as failed", async () => {
    const { sendForgotPasswordEmail } = await emailModule();
    resendState.failNext = 1;

    await sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=x");

    expect(resendState.sent).toHaveLength(0);
    const rows = pg.rowsFor(ADDRESS, "forgot_password");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].error).toBe("resend boom");
  });

  it("a successful send finalises its reserved row to sent with the provider id", async () => {
    const { sendForgotPasswordEmail } = await emailModule();

    await sendForgotPasswordEmail(ADDRESS, "Racer", "https://truedrafts.com/reset?token=x");

    const rows = pg.rowsFor(ADDRESS, "forgot_password");
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].resendId).toMatch(/^re_/);
  });
});

// ---------------------------------------------------------------------------
// Sibling path with the same shape
// ---------------------------------------------------------------------------

describe("welcome email de-duplication under concurrency", () => {
  it("two simultaneous account-create hooks send exactly one welcome", async () => {
    const { sendWelcomeEmail } = await emailModule();

    await Promise.all([
      sendWelcomeEmail(ADDRESS, "Racer", "reader"),
      sendWelcomeEmail(ADDRESS, "Racer", "reader"),
    ]);

    // Pre-fix both counted 0 against a cap of 1 and both sent.
    expect(resendState.sent).toHaveLength(1);
    expect(pg.rowsFor(ADDRESS, "welcome")).toHaveLength(1);
  });

  it("a later retry is still deduplicated", async () => {
    const { sendWelcomeEmail } = await emailModule();

    await sendWelcomeEmail(ADDRESS, "Racer", "writer");
    await sendWelcomeEmail(ADDRESS, "Racer", "writer");

    expect(resendState.sent).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Unlimited paths keep behaving as before
// ---------------------------------------------------------------------------

describe("emails without a rate limit", () => {
  it("verify-email still sends every time and logs one row per send", async () => {
    const { sendVerifyEmail } = await emailModule();

    await sendVerifyEmail(ADDRESS, "Racer", "https://truedrafts.com/verify?token=1");
    await sendVerifyEmail(ADDRESS, "Racer", "https://truedrafts.com/verify?token=2");

    expect(resendState.sent).toHaveLength(2);
    expect(pg.rowsFor(ADDRESS, "verify_email")).toHaveLength(2);
    expect(pg.rowsFor(ADDRESS, "verify_email").every((r) => r.status === "sent")).toBe(true);
  });
});
