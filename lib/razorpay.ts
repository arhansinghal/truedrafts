import crypto from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function authHeader(): string {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status: string;
  notes?: Record<string, string | number | boolean>;
};

export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
  method?: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string | number | boolean>;
  created_at?: number;
};

type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at?: number;
};

async function rzpFetch(
  path: string,
  init: RequestInit & { method: "GET" | "POST" },
): Promise<unknown> {
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    const e = new Error("Razorpay auth failed");
    (e as Error & { status?: number }).status = 401;
    throw e;
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Razorpay ${init.method} ${path} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

export async function createOrder(input: {
  amount: number;
  currency: string;
  receipt?: string;
  notes?: Record<string, string | number | boolean>;
}): Promise<RazorpayOrder> {
  return (await rzpFetch("/orders", {
    method: "POST",
    body: JSON.stringify(input),
  })) as RazorpayOrder;
}

// Order notes do NOT propagate to payment.notes in Razorpay. The verify-payment
// and webhook handlers must fetch the ORDER to read the trusted server-set notes
// (kind / ref_id / buyer_id) we attached at order-create time.
export async function fetchOrder(orderId: string): Promise<RazorpayOrder> {
  return (await rzpFetch(`/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  })) as RazorpayOrder;
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return (await rzpFetch(`/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
  })) as RazorpayPayment;
}

export async function createRefund(input: {
  paymentId: string;
  amount?: number;
  notes?: Record<string, string | number | boolean>;
}): Promise<RazorpayRefund> {
  const body: Record<string, unknown> = {};
  if (input.amount !== undefined) body.amount = input.amount;
  if (input.notes) body.notes = input.notes;
  return (await rzpFetch(`/payments/${encodeURIComponent(input.paymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify(body),
  })) as RazorpayRefund;
}

export function verifySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET must be set");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return timingSafeEqualHex(expected, input.signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET must be set");

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
