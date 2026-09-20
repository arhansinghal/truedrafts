"use client";

import { useState } from "react";
import { Check, Tag, X } from "lucide-react";
import { formatCents } from "@/lib/utils";

export type AppliedPromo = {
  code: string;
  subtotalCents: number;
  discountCents: number;
  chargedCents: number;
};

type ValidateResponse =
  | { ok: true; code: string; subtotalCents: number; discountCents: number; chargedCents: number }
  | { ok: false; reason: string; message: string };

/**
 * "Have a code?" box for a checkout surface.
 *
 * Validation is a round-trip to the server — the client never computes a
 * discount, it only displays one. The applied quote is handed back up so the
 * paywall can send the code along when it creates the order, and the server
 * re-prices from scratch at that point regardless.
 */
export function PromoCodeField({
  listingKind,
  listingId,
  onApplied,
}: {
  listingKind: "essay" | "application" | "bundle";
  listingId: string;
  onApplied: (promo: AppliedPromo | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<AppliedPromo | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function apply() {
    const code = value.trim();
    if (!code || checking) return;

    setChecking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, listingKind, listingId }),
      });
      const data = (await res.json()) as ValidateResponse & { error?: string };

      if (!res.ok) {
        setMessage(data.error ?? "Couldn't check that code.");
        return;
      }
      if (!data.ok) {
        setMessage(data.message);
        return;
      }

      const next: AppliedPromo = {
        code: data.code,
        subtotalCents: data.subtotalCents,
        discountCents: data.discountCents,
        chargedCents: data.chargedCents,
      };
      setApplied(next);
      onApplied(next);
    } catch {
      setMessage("Couldn't reach the server. Try again.");
    } finally {
      setChecking(false);
    }
  }

  function clear() {
    setApplied(null);
    setValue("");
    setMessage(null);
    onApplied(null);
  }

  if (applied) {
    return (
      <div className="flex w-full max-w-xs items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <Check className="h-3.5 w-3.5" />
          {applied.code} — {formatCents(applied.discountCents)} off
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-emerald-700/70 transition-colors hover:text-emerald-900"
          aria-label="Remove promo code"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700"
      >
        <Tag className="h-3.5 w-3.5" />
        Have a code?
      </button>
    );
  }

  return (
    <div className="w-full max-w-xs">
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void apply();
            }
          }}
          placeholder="Promo code"
          autoFocus
          maxLength={32}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-[#0851A0]"
          aria-label="Promo code"
        />
        <button
          type="button"
          onClick={() => void apply()}
          disabled={checking || !value.trim()}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {checking ? "…" : "Apply"}
        </button>
      </div>
      {message && (
        <p className="mt-1.5 text-xs text-red-500" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
