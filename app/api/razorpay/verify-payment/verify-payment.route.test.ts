import { describe, it, expect, vi, beforeEach } from "vitest";

// The route's collaborators are mocked so the test is a pure unit assertion:
// no network, no Razorpay credentials, no database. The symbol under test
// (the POST handler) is imported for real.
const verifySignature = vi.fn(() => {
  throw new Error("verifySignature must not run for a rejected body");
});
const fetchPayment = vi.fn(async () => {
  throw new Error("fetchPayment must not run for a rejected body");
});
const fetchOrder = vi.fn(async () => {
  throw new Error("fetchOrder must not run for a rejected body");
});
const grantEssayPurchase = vi.fn();
const grantApplicationPurchase = vi.fn();
const grantBundlePurchase = vi.fn();
const parseNotes = vi.fn();

vi.mock("@/lib/razorpay", () => ({
  verifySignature: (...args: unknown[]) => verifySignature(...(args as [])),
  fetchPayment: (...args: unknown[]) => fetchPayment(...(args as [])),
  fetchOrder: (...args: unknown[]) => fetchOrder(...(args as [])),
}));

vi.mock("@/lib/payments", () => ({
  grantEssayPurchase: (...args: unknown[]) => grantEssayPurchase(...(args as [])),
  grantApplicationPurchase: (...args: unknown[]) =>
    grantApplicationPurchase(...(args as [])),
  grantBundlePurchase: (...args: unknown[]) => grantBundlePurchase(...(args as [])),
  parseNotes: (...args: unknown[]) => parseNotes(...(args as [])),
}));

import { POST } from "@/app/api/razorpay/verify-payment/route";

/**
 * Builds a Request-like object that records whether the handler ever consumed
 * the body. Both text() and json() are instrumented, so the recording holds no
 * matter which one the handler reaches for.
 */
function makeRequest(body: string) {
  let bodyRead = false;
  const req = {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "content-length": String(body.length),
    }),
    text: async () => {
      bodyRead = true;
      return body;
    },
    json: async () => {
      bodyRead = true;
      return JSON.parse(body);
    },
  } as unknown as Request;

  return { req, wasBodyRead: () => bodyRead };
}

describe("POST /api/razorpay/verify-payment body handling", () => {
  beforeEach(() => {
    verifySignature.mockClear();
    fetchPayment.mockClear();
    fetchOrder.mockClear();
    grantEssayPurchase.mockClear();
    grantApplicationPurchase.mockClear();
    grantBundlePurchase.mockClear();
    parseNotes.mockClear();
  });

  it("rejects an oversized body via Content-Length without reading/parsing it", async () => {
    // ~4 KB of padding, no Razorpay fields at all.
    const body = JSON.stringify({ padding: "x".repeat(4096) });
    const { req, wasBodyRead } = makeRequest(body);

    const res = await POST(req);

    // The oversized request must be refused up front, not parsed and then
    // rejected as "missing or malformed fields".
    expect(res.status).toBe(413);
    expect(wasBodyRead()).toBe(false);

    // Nothing downstream may be touched for a refused request.
    expect(verifySignature).not.toHaveBeenCalled();
    expect(fetchPayment).not.toHaveBeenCalled();
    expect(fetchOrder).not.toHaveBeenCalled();
  });

  it("still returns 400 for a small body that omits the Razorpay fields", async () => {
    const body = JSON.stringify({ padding: "x" });
    const { req, wasBodyRead } = makeRequest(body);

    const res = await POST(req);

    expect(res.status).toBe(400);
    // A small body is legitimately read and inspected.
    expect(wasBodyRead()).toBe(true);

    const json = (await res.json()) as { error?: string };
    expect(typeof json.error).toBe("string");
    expect(json.error).toMatch(/razorpay/i);

    expect(verifySignature).not.toHaveBeenCalled();
    expect(fetchPayment).not.toHaveBeenCalled();
    expect(fetchOrder).not.toHaveBeenCalled();
  });
});