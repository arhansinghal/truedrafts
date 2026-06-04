"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay-client";

interface Props {
  applicationId: string;
  applicationSlug: string;
  priceCents: number;
  isLoggedIn: boolean;
}

export function ApplicationPaywall({
  applicationId,
  applicationSlug,
  priceCents,
  isLoggedIn,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        onSuccess: () => router.refresh(),
        onFailure: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
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
          : `Unlock Full Application — ${formatCents(priceCents)}`}
      </Button>
      {error && (
        <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>
      )}
      {!isLoggedIn && (
        <p className="text-xs text-gray-400">Sign in required to purchase</p>
      )}
    </div>
  );
}
