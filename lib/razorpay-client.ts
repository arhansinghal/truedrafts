/**
 * Client-side helper for opening the Razorpay Standard Checkout modal.
 * Used by every paywall component (essay, application, bundle).
 *
 *   await openRazorpayCheckout({
 *     createOrderUrl: `/api/essays/${id}/checkout`,
 *     onSuccess: () => router.refresh(),
 *   });
 *
 * Loads checkout.js lazily on first click (no global <Script>), guards against
 * double-injection, and runs the full happy-path: createOrder → modal → verify.
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayWindow = Window & {
  Razorpay?: new (options: RazorpayOptions) => {
    open: () => void;
    on: (event: string, callback: (resp: unknown) => void) => void;
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
};

type OrderResponse = {
  order_id: string;
  amount: number;
  currency: string;
  key_id?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
};

export type OpenCheckoutOptions = {
  createOrderUrl: string;
  /**
   * Extra fields for the create-order POST — currently just `{ promoCode }`.
   * Never a price: the server prices the order and the client only ever names
   * things (a listing id, a coupon string).
   */
  orderBody?: Record<string, unknown>;
  themeColor?: string;
  onSuccess?: (data: { paymentId: string; orderId: string }) => void;
  onFailure?: (message: string) => void;
  onDismiss?: () => void;
};

function loadCheckoutScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay can only load in the browser"));
      return;
    }
    if ((window as RazorpayWindow).Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Razorpay checkout.js")),
        { once: true },
      );
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout.js"));
    document.body.appendChild(s);
  });
}

export async function openRazorpayCheckout(opts: OpenCheckoutOptions): Promise<void> {
  // 1. Create the order server-side. The server validates entitlement, looks
  //    up the authoritative price, attaches notes, and returns details.
  const orderRes = await fetch(opts.createOrderUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts.orderBody ?? {}),
  });
  if (!orderRes.ok) {
    const { error, message } = (await orderRes.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    // A rejected promo code carries a human message worth surfacing verbatim.
    throw new Error(message || error || `Checkout failed (${orderRes.status})`);
  }
  const order = (await orderRes.json()) as OrderResponse;

  const keyId = order.key_id ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    throw new Error("Razorpay key id is not configured");
  }

  // 2. Load the Razorpay SDK.
  await loadCheckoutScript();
  const w = window as RazorpayWindow;
  if (!w.Razorpay) throw new Error("Razorpay SDK not available");

  // 3. Open the modal. The handler fires once the modal completes successfully.
  await new Promise<void>((resolve) => {
    const rzp = new w.Razorpay!({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name ?? "TrueDrafts",
      description: order.description,
      order_id: order.order_id,
      prefill: order.prefill,
      theme: { color: opts.themeColor ?? "#0851A0" },
      modal: {
        ondismiss: () => {
          opts.onDismiss?.();
          resolve();
        },
      },
      handler: async (response) => {
        try {
          const verifyRes = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const data = (await verifyRes.json().catch(() => ({}))) as {
            success?: boolean;
            error?: string;
          };
          if (!verifyRes.ok || !data.success) {
            throw new Error(data.error || "Payment verification failed");
          }
          opts.onSuccess?.({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
          });
        } catch (err) {
          opts.onFailure?.(err instanceof Error ? err.message : String(err));
        } finally {
          resolve();
        }
      },
    });

    rzp.on("payment.failed", (resp: unknown) => {
      const r = resp as { error?: { description?: string; reason?: string } };
      const message =
        r?.error?.description || r?.error?.reason || "Payment failed";
      opts.onFailure?.(message);
      resolve();
    });

    rzp.open();
  });
}
