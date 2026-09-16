import { describe, expect, it, vi, beforeEach } from "vitest";

// --- dependency doubles (never the symbol under test) -----------------------

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "user-1" } })),
  setSpy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        mocks.setSpy(values);
        return { where: async () => undefined };
      },
    }),
  },
  users: { id: "users.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (left: unknown, right: unknown) => ({ left, right }),
}));

import { POST } from "@/app/api/writer/onboarding/profile/route";

// --- a chunked request whose stream reports how much was actually pulled ----

function makeChunkedRequest(chunks: Uint8Array[]) {
  let pulledBytes = 0;
  let index = 0;

  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[index++];
      pulledBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });

  const req = {
    method: "POST",
    headers: new Headers({ "content-type": "application/json" }),
    body,
    async text(): Promise<string> {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let out = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) out += decoder.decode(value, { stream: true });
      }
      return out + decoder.decode();
    },
    async json(): Promise<unknown> {
      return JSON.parse(await (req as { text(): Promise<string> }).text());
    },
  };

  return {
    req: req as unknown as Request,
    get pulledBytes() {
      return pulledBytes;
    },
  };
}

function hugeJsonChunks(): Uint8Array[] {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [enc.encode('{"bio":"')];
  // 1000 x 1000 bytes = ~1 MB of syntactically valid JSON, far above any sane cap.
  const filler = enc.encode("a".repeat(1000));
  for (let i = 0; i < 1000; i++) chunks.push(filler);
  chunks.push(enc.encode('"}'));
  return chunks;
}

describe("POST /api/writer/onboarding/profile body limiting", () => {
  beforeEach(() => {
    mocks.setSpy.mockClear();
    mocks.getSession.mockClear();
  });

  it("rejects an oversized chunked body with 413 without buffering all of it", async () => {
    const { req, ...stream } = makeChunkedRequest(hugeJsonChunks());

    const res = await POST(req);

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "Payload too large" });

    // The route must stop pulling once the cap is exceeded, not read the whole ~1 MB.
    expect(stream.pulledBytes).toBeLessThan(200_000);

    // Nothing should have been written for a rejected payload.
    expect(mocks.setSpy).not.toHaveBeenCalled();
  });

  it("must still hold: a small valid body is accepted and saved", async () => {
    const enc = new TextEncoder();
    const { req } = makeChunkedRequest([
      enc.encode('{"name":"Ada",'),
      enc.encode('"country":" US "}'),
    ]);

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(mocks.setSpy).toHaveBeenCalledWith({ name: "Ada", country: "US" });
  });
});