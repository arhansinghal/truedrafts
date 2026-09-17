import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Fake db that models commit/rollback semantics for writer_universities.
// `db.transaction(cb)` runs the callback against a staged copy of the rows and
// only publishes it if the callback resolves. Direct `db.delete(...)` /
// `db.insert(...)` calls hit the committed rows immediately (no rollback) --
// exactly like a real database outside a transaction.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const writerUniversities: any = { writerId: "writer_universities.writer_id", __name: "writer_universities" };
  const applicationDrafts: any = {
    writerId: "application_drafts.writer_id",
    universityId: "application_drafts.university_id",
    __name: "application_drafts",
  };
  const collegeApplications: any = {
    writerId: "college_applications.writer_id",
    universityId: "college_applications.university_id",
    __name: "college_applications",
  };
  const universitiesTable: any = {
    id: "universities.id",
    name: "universities.name",
    slug: "universities.slug",
    __name: "universities",
  };

  const state = {
    // committed rows of writer_universities -- mutated in place, never reassigned
    committed: [] as any[],
    insertShouldFail: false,
    session: { user: { id: "writer-1" } } as any,
  };

  // A drizzle-ish client bound to a particular rows array.
  function client(rows: any[]) {
    return {
      delete(table: any) {
        return {
          where(_cond: any) {
            if (table === writerUniversities) rows.length = 0;
            return Promise.resolve(undefined);
          },
        };
      },
      insert(table: any) {
        return {
          values(vals: any) {
            if (table === writerUniversities) {
              if (state.insertShouldFail) {
                return Promise.reject(new Error("insert failed"));
              }
              rows.push(...(Array.isArray(vals) ? vals : [vals]));
            }
            return Promise.resolve(undefined);
          },
        };
      },
      select(_cols?: any) {
        return {
          from(_t: any) {
            return {
              where(_c: any) {
                return Promise.resolve([] as any[]);
              },
            };
          },
        };
      },
    };
  }

  const db: any = {
    ...client(state.committed),
    async transaction(cb: (tx: any) => Promise<unknown>) {
      const staged = [...state.committed];
      await cb(client(staged)); // throws => nothing is published => rollback
      state.committed.splice(0, state.committed.length, ...staged);
    },
  };

  return { db, state, writerUniversities, applicationDrafts, collegeApplications, universitiesTable };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => h.state.session } },
}));

vi.mock("@/lib/db", () => ({
  db: h.db,
  writerUniversities: h.writerUniversities,
}));

vi.mock("@/lib/db/schema", () => ({
  universities: h.universitiesTable,
  applicationDrafts: h.applicationDrafts,
  collegeApplications: h.collegeApplications,
  writerUniversities: h.writerUniversities,
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: any, b: any) => ({ op: "eq", a, b }),
  and: (...parts: any[]) => ({ op: "and", parts }),
  inArray: (a: any, b: any) => ({ op: "inArray", a, b }),
}));

import { POST } from "@/app/api/writer/onboarding/universities/route";

function makeReq(body: unknown): Request {
  return {
    headers: {} as any,
    json: async () => body,
  } as unknown as Request;
}

const EXISTING_ADMIT = {
  writerId: "writer-1",
  universityId: "uni-old",
  admittedYear: 2023,
  applicationProgress: 0,
  verifiedAdmit: false,
};

describe("POST /api/writer/onboarding/universities", () => {
  beforeEach(() => {
    h.state.committed.splice(0, h.state.committed.length);
    h.state.insertShouldFail = false;
    h.state.session = { user: { id: "writer-1" } };
  });

  it("keeps the existing admits when the replacement insert fails after the delete", async () => {
    h.state.committed.push({ ...EXISTING_ADMIT });
    h.state.insertShouldFail = true;

    await expect(
      POST(makeReq({ universities: [{ uniId: "uni-1", admittedYear: "2024" }] }))
    ).rejects.toThrow(/insert failed/);

    // The request failed as a whole, so the writer must not have lost their admits.
    expect(h.state.committed).toHaveLength(1);
    expect(h.state.committed[0].universityId).toBe("uni-old");
  });

  it("still replaces the admits when the insert succeeds", async () => {
    h.state.committed.push({ ...EXISTING_ADMIT });
    h.state.insertShouldFail = false;

    const res = await POST(makeReq({ universities: [{ uniId: "uni-1", admittedYear: "2024" }] }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(h.state.committed).toEqual([
      {
        writerId: "writer-1",
        universityId: "uni-1",
        admittedYear: 2024,
        applicationProgress: 0,
        verifiedAdmit: false,
      },
    ]);
  });
});