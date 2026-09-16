import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const dbSelect = vi.fn(() => ({
    from: () => ({
      where: () => ({ limit: selectLimit }),
    }),
  }));
  const findFirst = vi.fn();
  const ingestUrlSource = vi.fn();
  return { selectLimit, dbSelect, findFirst, ingestUrlSource };
});

vi.mock("@/lib/studio/enabled", () => ({ STUDIO_ENABLED: true }));

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.dbSelect,
    query: { studioSources: { findFirst: mocks.findFirst } },
  },
}));

vi.mock("@/lib/studio/ingest", () => ({ ingestUrlSource: mocks.ingestUrlSource }));

import { GET } from "@/app/api/cron/studio-refetch/route";

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  // One source is genuinely due: kind=url, never fetched, not ingesting.
  mocks.selectLimit.mockResolvedValue([
    { id: "src_1", uri: "https://example.com/page", lastFetchedAt: null },
  ]);
  mocks.findFirst.mockResolvedValue({
    id: "src_1",
    kind: "url",
    uri: "https://example.com/page",
    status: "ready",
    lastFetchedAt: null,
  });
  mocks.ingestUrlSource.mockResolvedValue({ reused: false, status: "ready" });
});

afterEach(() => {
  if (ORIGINAL_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  }
});

describe("GET /api/cron/studio-refetch auth gate", () => {
  it("returns 401 without touching the database when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(new Request("https://app.test/api/cron/studio-refetch"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    // Must refuse *before* any DB access or ingestion work.
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.ingestUrlSource).not.toHaveBeenCalled();
  });

  it("returns 401 without touching the database when CRON_SECRET is empty", async () => {
    process.env.CRON_SECRET = "";

    const res = await GET(new Request("https://app.test/api/cron/studio-refetch"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.ingestUrlSource).not.toHaveBeenCalled();
  });

  it("still runs the refetch for a correct Bearer token (fix must not 401 everything)", async () => {
    process.env.CRON_SECRET = "s3cret";

    const res = await GET(
      new Request("https://app.test/api/cron/studio-refetch", {
        headers: { authorization: "Bearer s3cret" },
      }),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      scanned: 1,
      results: [{ id: "src_1", outcome: "ready" }],
    });
    expect(mocks.dbSelect).toHaveBeenCalledTimes(1);
    expect(mocks.ingestUrlSource).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong Bearer token before doing any work", async () => {
    process.env.CRON_SECRET = "s3cret";

    const res = await GET(
      new Request("https://app.test/api/cron/studio-refetch", {
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(res.status).toBe(401);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.ingestUrlSource).not.toHaveBeenCalled();
  });
});