"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine } from "lucide-react";

interface PayoutButtonProps {
  availableCents: number;
}

export function PayoutButton({ availableCents }: PayoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function requestPayout() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/writer/payout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Payout request failed.", ok: false });
      } else {
        setMessage({ text: "Payout requested! Funds will arrive in 2–5 business days.", ok: true });
      }
    } finally {
      setLoading(false);
    }
  }

  const canPayout = availableCents >= 1000;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        className="gap-2"
        disabled={!canPayout || loading}
        onClick={requestPayout}
      >
        <ArrowDownToLine className="h-4 w-4" />
        {loading ? "Processing..." : "Request Payout"}
      </Button>
      {!canPayout && (
        <p className="text-xs text-gray-400">Minimum $10.00 available balance required.</p>
      )}
      {message && (
        <p className={`text-xs ${message.ok ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
