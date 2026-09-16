import { beforeEach, describe, expect, it, vi } from "vitest";

// Fake table objects: identity is what the fake db driver switches on.
const tables = vi.hoisted(() => ({
  writerUniversities: {
    __name: "writer_universities",
    writerId: { __col: "writer_id" },
    universityId: { __col: "university_id" },
  },
  universities: {
    __name: "universities",
    id: { __col: "id" },
    name: { __col: "name" },
    slug: { __col: "slug" },
  },
  applicationDrafts: {
    __name: "application_drafts",
    writerId: { __col: "writer_id" },
    universityId: { __col: "university_id" },
  },
  collegeApplications: {
    __name: "college_applications",
    writerId: { __col: "writer_id" },
    universityId: { __col: "university_id" },
  },
}));

const state = vi.hoisted(() => ({
  // Persisted state of the writer's admits, as the DB would hold it.
  writerUniversityRows: [] as any[],
  deleteCalls: [] as unknown[],
  insertedAdmits: [] as any[],
  insertedDrafts: [] as any[],
  universityRows: [] as any[],
  draftRows: [] as any[],
  appRows: [] as any[],
  session: null as any,
}));

// Keep the test pure: drizzle's expression builders are replaced by inert markers.
vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, val: unknown) => ({ op: "eq", col, val }),
  and: (...parts: unknown[]) => ({ op: "and", parts }),
  inArray: (col: unknown, vals: unknown[]) => ({ op: "inArray", col, vals }),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => state.session } },
}));

vi.mock("@/lib/db/schema", () => ({
  universities: tables.universities,
  applicationDrafts: tables.applicationDrafts,
  collegeApplications: tables.collegeApplications,
  writerUniversities: tables.writerUniversities,
}));

vi.mock("@/lib/db", () => {
  const db = {
    delete(table: any) {
      return {
        where: async () => {
          state.deleteCalls.push(table);
          if (table === tables.writerUniversities) state.writerUniversityRows = [];
          return { rowCount: 0 };
        },
      };
    },
    insert(table: any) {
      return {
        values: async (rows: any[]) => {
          if (table === tables.writerUniversities) {
            for (const row of rows) {
              // A real integer column rejects NaN / non-integers.
              if (row.admittedYear !== null && !Number.isInteger(row.admittedYear)) {
                throw new Error('invalid input syntax for type integer: "NaN"');
              }
            }
            state.insertedAdmits.push(...rows);
            state.writerUniversityRows.push(...rows);
          } else if (table === tables.applicationDrafts) {
            state.insertedDrafts.push(...rows);
          }
          return { rowCount: rows.length };
        },
      };
    },
    select(_fields: any) {
      return {
        from(table: any) {
          const rows =
            table === tables.universities
              ? state.universityRows
              : table === tables.applicationDrafts
                ? state.draftRows
                : table === tables.collegeApplications
                  ? state.appRows
                  : [];
          return { where: async () => rows };
        },
      };
    },
  };
  return { db, writerUniversities: tables.writerUniversities };
});

import { POST } from "@/app/api/writer/onboarding/universities/route";

function makeReq(body: unknown): Request {
  return {
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body,
  } as unknown as Request;
}

const WRITER_ID = "writer-1";
const UNI_ID = "uni-123";

beforeEach(() => {
  state.session = { user: { id: WRITER_ID } };
  state.deleteCalls = [];
  state.insertedAdmits = [];
  state.insertedDrafts = [];
  state.draftRows = [];
  state.appRows = [];
  state.universityRows = [{ id: UNI_ID, name: "Test University", slug: "test-university" }];
  // The writer already has an admit on record.
  state.writerUniversityRows = [
    {
      writerId: WRITER_ID,
      universityId: UNI_ID,
      admittedYear: 2023,
      applicationProgress: 40,
      verifiedAdmit: true,
    },
  ];
});

describe("POST /api/writer/onboarding/universities", () => {
  it("rejects a malformed admittedYear without destroying the writer's existing admits", async () => {
    const before = [...state.writerUniversityRows];

    let res: Response | null = null;
    let thrown: unknown = null;
    try {
      res = await POST(
        makeReq({ universities: [{ uniId: UNI_ID, admittedYear: "not-a-year" }] })
      );
    } catch (err) {
      thrown = err;
    }

    // The bug: the delete runs first, so the writer's admits are wiped and the
    // replacement insert then rejects the NaN year.
    expect(state.deleteCalls).toEqual([]);
    expect(state.writerUniversityRows).toEqual(before);

    expect(thrown).toBeNull();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(400);
    const body = (await res!.json()) as { error?: string };
    expect(body.error).toBeTruthy();

    // Nothing was written anywhere on the rejected path.
    expect(state.insertedAdmits).toEqual([]);
    expect(state.insertedDrafts).toEqual([]);
  });

  it("still replaces admits and seeds a draft for a valid year", async () => {
    const res = await POST(
      makeReq({ universities: [{ uniId: UNI_ID, admittedYear: "2024" }] })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(state.deleteCalls).toEqual([tables.writerUniversities]);
    expect(state.insertedAdmits).toEqual([
      {
        writerId: WRITER_ID,
        universityId: UNI_ID,
        admittedYear: 2024,
        applicationProgress: 0,
        verifiedAdmit: false,
      },
    ]);
    expect(state.writerUniversityRows).toHaveLength(1);

    expect(state.insertedDrafts).toHaveLength(1);
    expect(state.insertedDrafts[0].universityId).toBe(UNI_ID);
    expect(JSON.parse(state.insertedDrafts[0].data)).toEqual({
      universityId: UNI_ID,
      admittedYear: "2024",
    });
  });
});