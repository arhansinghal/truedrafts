import {
  verifySignature,
  fetchPayment,
  fetchOrder,
  type RazorpayPayment,
  type RazorpayOrder,
} from "@/lib/razorpay";
import {
  grantEssayPurchase,
  grantApplicationPurchase,
  grantBundlePurchase,
  parseNotes,
} from "@/lib/payments";

type Body = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};

// Razorpay IDs are <prefix>_<base62>. Validate format before signing/fetching so
// malformed input fails fast and never gets logged as a "Razorpay returned 4xx".
const ORDER_ID_RE = /^order_[A-Za-z0-9]{6,}$/;
const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]{6,}$/;
const SIGNATURE_RE = /^[a-f0-9]{64}$/;

// Upper bound on the verify-payment request body; the three expected fields are
// well under 200 bytes, so anything larger is rejected without being parsed.
const MAX_BODY_BYTES = 1024;

export async function POST(req: Request) {
  // A valid verify-payment body is three short strings (< 200 bytes). Refuse to
  // buffer/parse anything larger so an oversized body is rejected before req.json().
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large" }, { status: 413 });
  }

  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;

  if (
    typeof orderId !== "string" ||
    typeof paymentId !== "string" ||
    typeof signature !== "string" ||
    !ORDER_ID_RE.test(orderId) ||
    !PAYMENT_ID_RE.test(paymentId) ||
    !SIGNATURE_RE.test(signature)
  ) {
    return Response.json(
      { error: "Missing or malformed razorpay_order_id, razorpay_payment_id, or razorpay_signature" },
      { status: 400 },
    );
  }

  if (!verifySignature({ orderId, paymentId, signature })) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Signature valid — pull BOTH the payment (for status/amount) and the order
  // (for trusted server-set notes). Order notes do NOT propagate to payment
  // notes in Razorpay, so we always read routing from the order, never from
  // anything the client could influence.
  let payment: RazorpayPayment;
  let order: RazorpayOrder;
  try {
    [payment, order] = await Promise.all([
      fetchPayment(paymentId),
      fetchOrder(orderId),
    ]);
  } catch (err) {
    console.error("verify-payment: Razorpay fetch failed:", err);
    return Response.json({ error: "Failed to verify with Razorpay" }, { status: 502 });
  }

  if (payment.order_id !== orderId) {
    return Response.json({ error: "Order mismatch" }, { status: 400 });
  }

  // Only "captured" means the customer's money has settled to us. "authorized"
  // is pre-settlement and may never capture — granting on it exposes us to
  // free entitlement. Standard Checkout default is auto-capture (payment_capture
  // = 1), so we should virtually always see "captured" here.
  if (payment.status !== "captured") {
    return Response.json(
      { error: `Payment not captured (status: ${payment.status})` },
      { status: 400 },
    );
  }

  if (payment.currency !== "INR" || order.currency !== "INR") {
    return Response.json({ error: "Unsupported currency" }, { status: 400 });
  }

  if (
    !Number.isFinite(payment.amount) ||
    !Number.isInteger(payment.amount) ||
    payment.amount <= 0
  ) {
    return Response.json({ error: "Invalid payment amount" }, { status: 400 });
  }

  // Hard fail on any amount discrepancy — we never enable partial capture.
  if (payment.amount !== order.amount) {
    console.error("verify-payment: payment/order amount mismatch", {
      paymentId,
      orderId,
      paymentAmount: payment.amount,
      orderAmount: order.amount,
    });
    return Response.json({ error: "Amount mismatch" }, { status: 400 });
  }

  const routed = parseNotes(order.notes);
  if (!routed) {
    console.error("verify-payment: missing/unrecognized notes on order", {
      paymentId,
      orderId,
      notes: order.notes,
    });
    return Response.json({ error: "Order metadata missing" }, { status: 500 });
  }

  try {
    let result;
    switch (routed.kind) {
      case "essay":
        result = await grantEssayPurchase({
          razorpayPaymentId: paymentId,
          buyerId: routed.buyerId,
          essayId: routed.refId,
          amountCents: payment.amount,
        });
        break;
      case "application":
        result = await grantApplicationPurchase({
          razorpayPaymentId: paymentId,
          buyerId: routed.buyerId,
          applicationId: routed.refId,
          amountCents: payment.amount,
        });
        break;
      case "bundle":
        result = await grantBundlePurchase({
          razorpayOrderId: orderId,
          amountCents: payment.amount,
        });
        break;
    }

    if (result === "missing") {
      return Response.json({ error: "Referenced item missing" }, { status: 404 });
    }
    return Response.json({
      success: true,
      payment_id: paymentId,
      order_id: orderId,
      result, // "granted" or "already"
    });
  } catch (err) {
    console.error("verify-payment: grant failed:", err);
    return Response.json({ error: "Failed to record purchase" }, { status: 500 });
  }
}
