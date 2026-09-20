"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { PromoCodeField, type AppliedPromo } from "@/components/checkout/PromoCodeField";

interface Props {
  applicationId: string;
  applicationSlug: string;
  priceCents: number;
  isLoggedIn: boolean;
  viewerRole?: string | null;
}

export function ApplicationPaywall({
  applicationId,
  applicationSlug,
  priceCents,
  isLoggedIn,
  viewerRole,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);

  // What the button says. The server re-prices the order from scratch, so this
  // is a display of the quote, never the thing that decides the charge.
  const payableCents = promo ? promo.chargedCents : priceCents;

  async function handleUnlock() {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/applications/${applicationSlug}`;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await openRazorpayCheckout({
        createOrderUrl: `/api/applications/${applicationId}/checkout`,
        orderBody: promo ? { promoCode: promo.code } : undefined,
        onSuccess: () => router.refresh(),
        onFailure: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // Writer accounts can browse but not purchase. They never see this on their
  // own application — that renders as already-unlocked (isPurchased).
  if (viewerRole === "writer") {
    return (
      <div className="flex flex-col items-center gap-1.5 w-full text-center">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-600">
          <Lock className="h-4 w-4 text-gray-400" />
          Writer accounts can&apos;t purchase
        </div>
        <p className="text-xs text-gray-400 max-w-xs">
          You&apos;re signed in as a writer. Applications can only be unlocked from a reader account.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <Button
        onClick={handleUnlock}
        disabled={loading}
        size="lg"
        className="w-full max-w-xs gap-2 bg-[#0851A0] hover:bg-[#063d85] text-white"
        style={{ background: "#0851A0" }}
      >
        <Lock className="h-4 w-4" />
        {loading
          ? "Opening payment…"
          : `Unlock Full Application — ${formatCents(payableCents)}`}
      </Button>

      {promo && (
        <p className="text-xs text-gray-400">
          <span className="line-through">{formatCents(priceCents)}</span>{" "}
          with {promo.code}
        </p>
      )}

      {isLoggedIn && viewerRole !== "writer" && (
        <PromoCodeField
          listingKind="application"
          listingId={applicationId}
          onApplied={setPromo}
        />
      )}

      {error && (
        <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>
      )}
      {!isLoggedIn && (
        <p className="text-xs text-gray-400">Sign in required to purchase</p>
      )}
    </div>
  );
}
