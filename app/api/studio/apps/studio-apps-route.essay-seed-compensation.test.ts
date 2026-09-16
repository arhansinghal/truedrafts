import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared in-memory store, hoisted so the vi.mock factories can reach it.
const h = vi.hoisted(() => {
  const state = {
    apps: [] as Array<Record<string, unknown> & { id: string; userId: string }>,
    essays: [] as Array<Record<string, unknown> & { id: string; appId: string }>,
    universities: [{ id: "uni-1", name: "Stanford" }] as Array<{ id: string; name: string }>,
    failEssayInsert: false,
    seq: 0,
  };
  return { state };
});

// drizzle-orm operators are replaced with inert descriptors so the fake db can
// read the operand back without building real SQL.
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, value: unknown) => ({ kind: "eq", col, value }),
  desc: (col: unknown) => ({ kind: "desc", col }),
}));

vi.mock("@/lib/db/schema", () => ({
  studioApps: {
    __name: "studio_apps",
    id: "studio_apps.id",
    userId: "studio_apps.user_id",
    updatedAt: "studio_apps.updated_at",
  },
  studioEssays: {
    __name: "studio_essays",
    id: "studio_essays.id",
    appId: "studio_essays.app_id",
  },
  universities: { __name: "universities", id: "universities.id" },
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
    },
  },
}));

vi.mock("@/lib/db", () => {
  const { state } = h;

  const tableName = (t: unknown) => (t as { __name: string }).__name;

  const db = {
    query: {
      universities: {
        findFirst: async ({ where }: { where: { value: string } }) =>
          state.universities.find((u) => u.id === where.value),
      },
      studioApps: {
        findMany: async ({ where }: { where: { value: string } }) =>
          state.apps
            .filter((a) => a.userId === where.value)
            .map((a) => ({
              ...a,
              university: state.universities.find((u) => u.id === a.universityId),
              essays: state.essays.filter((e) => e.appId === a.id),
            })),
      },
    },

    insert(table: unknown) {
      return {
        values(vals: Record<string, unknown>) {
          const run = () => {
            const name = tableName(table);
            if (name === "studio_apps") {
              const row = { id: `app-${++state.seq}`, updatedAt: new Date(0), ...vals } as (typeof state.apps)[number];
              state.apps.push(row);
              return [row];
            }
            if (name === "studio_essays") {
              if (state.failEssayInsert) throw new Error("essay insert failed");
              const row = { id: `essay-${++state.seq}`, ...vals } as (typeof state.essays)[number];
              state.essays.push(row);
              return [row];
            }
            throw new Error(`unexpected insert into ${name}`);
          };

          // Awaitable *and* chainable with .returning(), like a drizzle builder.
          return {
            returning: () => Promise.resolve().then(run),
            then: (
              onFulfilled?: (v: unknown) => unknown,
              onRejected?: (e: unknown) => unknown,
            ) => Promise.resolve().then(run).then(onFulfilled, onRejected),
          };
        },
      };
    },

    delete(table: unknown) {
      return {
        where: async (cond: { value: string }) => {
          if (tableName(table) === "studio_apps") {
            const idx = state.apps.findIndex((a) => a.id === cond.value);
            if (idx >= 0) state.apps.splice(idx, 1);
          }
          return undefined;
        },
      };
    },
  };

  return { db };
});

import { GET, POST } from "@/app/api/studio/apps/route";

const { state } = h;

function makeReq(body?: unknown): Request {
  return {
    headers: {} as unknown as Headers,
    json: async () => body,
  } as unknown as Request;
}

beforeEach(() => {
  state.apps.length = 0;
  state.essays.length = 0;
  state.failEssayInsert = false;
  state.seq = 0;
});

describe("POST /api/studio/apps essay seeding", () => {
  it("persists no application when seeding the Common App essay fails", async () => {
    state.failEssayInsert = true;

    // The route may reject or return a non-201 response; either is acceptable.
    // What must never happen is an application surviving in storage.
    const outcome = await POST(makeReq({ universityId: "uni-1" })).then(
      (res) => ({ rejected: false as const, res }),
      (err) => ({ rejected: true as const, err }),
    );

    if (!outcome.rejected) {
      expect(outcome.res.status).not.toBe(201);
    }

    // The bug: the studioApps row inserted before the failure stays behind.
    expect(state.apps).toHaveLength(0);
    expect(state.essays).toHaveLength(0);

    const getRes = await GET(makeReq());
    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toEqual([]);
  });

  it("still creates the application with a seeded Common App essay on success", async () => {
    const res = await POST(makeReq({ universityId: "uni-1" }));
    expect(res.status).toBe(201);

    const created = (await res.json()) as { id: string; title: string };
    expect(created.title).toBe("Stanford Application");
    expect(state.apps).toHaveLength(1);

    const getRes = await GET(makeReq());
    const apps = (await getRes.json()) as Array<{
      id: string;
      essays: Array<{ title: string }>;
    }>;
    expect(apps).toHaveLength(1);
    expect(apps[0].id).toBe(created.id);
    expect(apps[0].essays.map((e) => e.title)).toEqual(["Common App Essay"]);
  });
});