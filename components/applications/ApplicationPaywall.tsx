"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Props {
  applicationId: string;
  applicationSlug: string;
  priceCents: number;
  isLoggedIn: boolean;
}

export function ApplicationPaywall({ applicationId, applicationSlug, priceCents, isLoggedIn }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleUnlock() {
    if (!isLoggedIn) {
      window.location.href = `/login?redirect=/applications/${applicationSlug}`;
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/checkout`, { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
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
        {loading ? "Redirecting..." : `Unlock Full Application — ${formatCents(priceCents)}`}
      </Button>
      {!isLoggedIn && (
        <p className="text-xs text-gray-400">Sign in required to purchase</p>
      )}
    </div>
  );
}
