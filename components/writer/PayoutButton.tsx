"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, X } from "lucide-react";
import { PayoutMethodForm } from "./PayoutMethodForm";
import type { MaskedPayoutMethod } from "@/lib/payout-methods";
import { formatCents } from "@/lib/utils";

interface PayoutButtonProps {
  availableCents: number;
  // Server-rendered snapshot of the writer's methods. When the parent page
  // already fetched them (the /writer/payout page does), pass them in so the
  // button starts with correct state instead of racing a client fetch.
  initialMethods?: MaskedPayoutMethod[];
}

export function PayoutButton({ availableCents, initialMethods }: PayoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showMethodModal, setShowMethodModal] = useState(false);

  // Methods are used only for the *display* line ("Sending to your …"). They
  // are NOT used to decide whether to open the modal — that decision is made
  // by the server (422 payout_method_required), which is the only source of
  // truth and can't go stale.
  const [methods, setMethods] = useState<MaskedPayoutMethod[] | null>(
    initialMethods ?? null,
  );

  // Keep display in sync if the parent re-renders with fresh server data
  // (e.g. after router.refresh() when a method is added on the same page).
  useEffect(() => {
    if (initialMethods) setMethods(initialMethods);
  }, [initialMethods]);

  async function loadMethods() {
    try {
      const res = await fetch("/api/writer/payout-methods");
      if (res.ok) {
        const list = (await res.json()) as MaskedPayoutMethod[];
        setMethods(list);
        return list;
      }
    } catch {
      // non-fatal — gating still falls back to the server 422
    }
    return [] as MaskedPayoutMethod[];
  }

  // If the parent didn't hand us methods, fetch them once for the display line.
  useEffect(() => {
    if (!initialMethods) loadMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultMethod = methods?.find((m) => m.isDefault) ?? null;

  async function requestPayout() {
    setLoading(true);
    setMessage(null);
    try {
      // Always ask the server. It checks the DB for a default method and
      // returns 422 only when there genuinely is none — so a method added
      // moments ago (via the manager on this page) is always respected.
      const res = await fetch("/api/writer/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (res.status === 422 && data.error === "payout_method_required") {
        await loadMethods();
        setShowMethodModal(true);
        return;
      }
      if (!res.ok) {
        setMessage({ text: data.error ?? "Payout request failed.", ok: false });
        return;
      }
      setMessage({
        text: `Payout of ${formatCents(availableCents)} requested. We'll send it to your ${describeMethod(defaultMethod)} within 2–5 business days.`,
        ok: true,
      });
      // Refresh so the new payout shows in history and balances update.
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleMethodSaved(method: MaskedPayoutMethod) {
    setMethods((prev) => {
      const others = (prev ?? []).filter((m) => m.id !== method.id);
      if (method.isDefault) others.forEach((m) => (m.isDefault = false));
      return [method, ...others];
    });
    setShowMethodModal(false);
    setMessage({
      text: "Payout method saved. Click Request Payout to send your earnings.",
      ok: true,
    });
    // Re-render the page so the embedded methods list reflects the new method.
    router.refresh();
  }

  const canPayout = availableCents >= 100000; // ₹1000 minimum, in paise

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
        <p className="text-xs text-gray-400">
          Minimum {formatCents(100000)} available balance required.
        </p>
      )}

      {canPayout && defaultMethod && (
        <p className="text-xs text-gray-500">
          Sending to your {describeMethod(defaultMethod)}.{" "}
          <a href="#payout-methods" className="text-[#0851A0] underline">
            Change
          </a>
        </p>
      )}

      {message && (
        <p className={`text-xs ${message.ok ? "text-green-600" : "text-red-500"}`}>
          {message.text}
        </p>
      )}

      {showMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowMethodModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              How should we send your earnings?
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Required before your first payout. You can change this anytime.
            </p>
            <PayoutMethodForm
              onSaved={handleMethodSaved}
              onCancel={() => setShowMethodModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function describeMethod(m: MaskedPayoutMethod | null): string {
  if (!m) return "payout method";
  switch (m.kind) {
    case "upi":
      return `UPI (${m.upiId ?? ""})`;
    case "bank_account":
      return `bank account ${m.bankAccountNumberMasked ?? ""}`;
    case "zelle":
      return `Zelle (${m.zelleEmail ?? m.zellePhone ?? ""})`;
  }
}
