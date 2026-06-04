"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from "lucide-react";
import { openRazorpayCheckout } from "@/lib/razorpay-client";

interface Props {
  bundleId: string;
  isLoggedIn: boolean;
  bundleSlug: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function BundleCheckoutButton({
  bundleId,
  isLoggedIn,
  bundleSlug,
  disabled,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Button
        className="w-full"
        onClick={() => router.push(`/login?redirect=/bundles/${bundleSlug}`)}
      >
        <Lock className="h-4 w-4" />
        Sign in to unlock
      </Button>
    );
  }

  if (disabled) {
    return (
      <div className="space-y-2">
        <Button className="w-full" disabled>
          {disabledReason ?? "Unavailable"}
        </Button>
      </div>
    );
  }

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      await openRazorpayCheckout({
        createOrderUrl: `/api/bundles/${bundleId}/checkout`,
        onSuccess: () => router.refresh(),
        onFailure: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={handleClick} disabled={pending}>
        {pending ? "Opening payment…" : "Unlock bundle"}
      </Button>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-[11px] text-gray-400 text-center leading-snug">
        One Razorpay checkout, one charge. <strong>All sales are final — no refunds.</strong>
      </p>
    </div>
  );
}
