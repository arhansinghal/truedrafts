"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Image from "next/image";
import { formatCents } from "@/lib/utils";
import { openRazorpayCheckout } from "@/lib/razorpay-client";

interface PaywallOverlayProps {
  essayId: string;
  essaySlug: string;
  priceCents: number;
  uniName: string;
  uniLogo?: string | null;
  isLoggedIn: boolean;
  isPurchased: boolean;
}

export function PaywallOverlay({
  essayId,
  essaySlug,
  priceCents,
  uniName,
  uniLogo,
  isLoggedIn,
  isPurchased,
}: PaywallOverlayProps) {
  const router = useRouter();
  const blurRef = useRef<HTMLDivElement>(null);
  const previewFired = useRef(false);
  const [showSticky, setShowSticky] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPurchased) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !previewFired.current) {
          previewFired.current = true;
          fetch(`/api/essays/${essayId}/preview`, { method: "POST" }).catch(() => {});
        }
        setShowSticky(entry.isIntersecting || entry.boundingClientRect.top < 0);
      },
      { threshold: 0.1 },
    );
    if (blurRef.current) observer.observe(blurRef.current);
    return () => observer.disconnect();
  }, [essayId, isPurchased]);

  async function handleUnlock() {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/essays/${essaySlug}`;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await openRazorpayCheckout({
        createOrderUrl: `/api/essays/${essayId}/checkout`,
        onSuccess: () => router.refresh(),
        onFailure: (msg) => setError(msg),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (isPurchased) return null;

  return (
    <>
      <div ref={blurRef} className="relative mt-6 overflow-hidden rounded-lg">
        <div className="select-none blur-sm pointer-events-none text-gray-500 font-serif leading-relaxed text-base px-1">
          <p>
            The rest of this essay reveals how this experience shaped the author&apos;s perspective,
            their unique approach to challenges, and what ultimately led to their acceptance at {uniName}.
            Unlock the full essay to read every word of this successful application.
          </p>
          <p className="mt-4">
            Every detail, every carefully chosen word, every personal insight that resonated with
            the admissions committee — all available to you after unlocking.
          </p>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/60 to-white pointer-events-none" />

        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-4 px-4">
          <div className="flex items-center gap-2 mb-3 text-sm text-gray-500">
            <Lock className="h-4 w-4" />
            <span>Full essay locked</span>
          </div>
          <Button onClick={handleUnlock} disabled={loading} size="lg" className="w-full max-w-xs gap-2">
            <Lock className="h-4 w-4" />
            {loading ? "Opening payment…" : `Unlock Full Essay — ${formatCents(priceCents)}`}
          </Button>
          {error && (
            <p className="mt-2 text-xs text-red-500 text-center max-w-xs">{error}</p>
          )}
          {!isLoggedIn && (
            <p className="mt-2 text-xs text-gray-400">Sign in required to purchase</p>
          )}
        </div>
      </div>

      {showSticky && (
        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="container mx-auto max-w-3xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {uniLogo ? (
                <Image src={uniLogo} alt={uniName} width={28} height={28} className="rounded-sm object-contain" />
              ) : (
                <div className="h-7 w-7 rounded-sm bg-gray-100 flex items-center justify-center text-xs font-bold">
                  {uniName[0]}
                </div>
              )}
              <span className="text-sm font-medium text-gray-700 hidden sm:block">
                {uniName} Essay
              </span>
            </div>
            <Button onClick={handleUnlock} disabled={loading} size="sm" className="gap-2 shrink-0">
              <Lock className="h-4 w-4" />
              {loading ? "..." : `Unlock — ${formatCents(priceCents)}`}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
