import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getSession = vi.fn();
  const where = vi.fn(async () => ({ rowCount: 1 }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { getSession, where, set, update };
});

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/db", () => ({
  db: { update: mocks.update },
  users: { id: "users.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (left: unknown, right: unknown) => ({ left, right }),
}));

import { PATCH } from "@/app/api/writer/settings/route";

const MAX_BODY_BYTES = 64 * 1024;

function streamOf(text: string, chunkSize = 16 * 1024): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

function patchRequest(text: string): Request {
  return new Request("http://localhost/api/writer/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: streamOf(text),
    // undici requires half-duplex when the body is a stream
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("PATCH /api/writer/settings body limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.where.mockResolvedValue({ rowCount: 1 });
  });

  it("rejects an authenticated chunked body larger than the route limit with 413 and never writes", async () => {
    // Valid JSON, ~256KB, streamed in 16KB chunks -> far above MAX_BODY_BYTES.
    const oversizedBio = "a".repeat(4 * MAX_BODY_BYTES);
    const payload = JSON.stringify({ bio: oversizedBio });
    expect(payload.length).toBeGreaterThan(MAX_BODY_BYTES);

    const res = await PATCH(patchRequest(payload));

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "Payload too large" });
    // The oversized body must never reach the database layer.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("still accepts and persists a normal, small update (must keep passing)", async () => {
    const res = await PATCH(patchRequest(JSON.stringify({ name: "  Ada  ", bio: " hi " })));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith({ name: "Ada", bio: "hi" });
    expect(mocks.where).toHaveBeenCalledTimes(1);
  });
});