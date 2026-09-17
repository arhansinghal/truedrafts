import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression test: a refund.processed webhook for a *bundle parent* payment
 * (no row in purchases.razorpayPaymentId) must NOT be acked with 200 when the
 * Razorpay payment lookup fails. Acking it permanently drops the bundle
 * reversal, because Razorpay will never redeliver.
 */

const mocks = vi.hoisted(() => ({
  verifyWebhookSignature: vi.fn(() => true),
  fetchPayment: vi.fn(),
  fetchOrder: vi.fn(),
  purchasesFindFirst: vi.fn(),
  purchasesFindMany: vi.fn(),
  bundlePurchasesFindFirst: vi.fn(),
  essaysFindFirst: vi.fn(),
  applicationsFindFirst: vi.fn(),
  applicationsFindMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/razorpay", () => ({
  verifyWebhookSignature: mocks.verifyWebhookSignature,
  fetchPayment: mocks.fetchPayment,
  fetchOrder: mocks.fetchOrder,
}));

vi.mock("@/lib/payments", () => ({
  grantEssayPurchase: vi.fn(),
  grantApplicationPurchase: vi.fn(),
  grantBundlePurchase: vi.fn(),
  parseNotes: vi.fn(() => null),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      purchases: {
        findFirst: mocks.purchasesFindFirst,
        findMany: mocks.purchasesFindMany,
      },
      bundlePurchases: { findFirst: mocks.bundlePurchasesFindFirst },
      essays: { findFirst: mocks.essaysFindFirst },
      collegeApplications: {
        findFirst: mocks.applicationsFindFirst,
        findMany: mocks.applicationsFindMany,
      },
    },
    transaction: mocks.transaction,
  },
}));

import { POST } from "@/app/api/webhooks/razorpay/route";

function refundRequest(paymentId: string): Request {
  const body = JSON.stringify({
    event: "refund.processed",
    payload: {
      refund: {
        entity: {
          id: "rfnd_test_1",
          payment_id: paymentId,
          amount: 500000,
          status: "processed",
        },
      },
    },
  });
  return new Request("https://truedrafts.com/api/webhooks/razorpay", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": "deadbeef",
    },
  });
}

describe("razorpay webhook refund.processed — bundle-parent order lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyWebhookSignature.mockReturnValue(true);
    // Not a single-item purchase: this payment id is a bundle parent payment.
    mocks.purchasesFindFirst.mockResolvedValue(undefined);
    mocks.purchasesFindMany.mockResolvedValue([]);
    mocks.applicationsFindMany.mockResolvedValue([]);
    mocks.transaction.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks Razorpay to retry (5xx) when fetchPayment fails, instead of acking and dropping the reversal", async () => {
    mocks.fetchPayment.mockRejectedValue(new Error("ETIMEDOUT talking to Razorpay"));

    const res = await POST(refundRequest("pay_bundle_parent_1"));

    // The bug: this returns 200 and the refund is silently dropped forever.
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(500);

    // And nothing was reversed, so the retry is the only chance we get.
    expect(mocks.bundlePurchasesFindFirst).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("must still hold: acks with 200 when the payment resolves but no bundle matches", async () => {
    mocks.fetchPayment.mockResolvedValue({ order_id: "order_unknown_1" });
    mocks.bundlePurchasesFindFirst.mockResolvedValue(undefined);

    const res = await POST(refundRequest("pay_unknown_1"));

    expect(res.status).toBe(200);
    expect(mocks.bundlePurchasesFindFirst).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});