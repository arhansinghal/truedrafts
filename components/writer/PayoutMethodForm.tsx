"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MaskedPayoutMethod, PayoutMethodKind } from "@/lib/payout-methods";

interface PayoutMethodFormProps {
  // If `existing` is set, the form is in EDIT mode; submitting PATCHes
  // /api/writer/payout-methods/[id]. Otherwise it's CREATE mode → POST.
  existing?: MaskedPayoutMethod | null;
  onSaved: (method: MaskedPayoutMethod) => void;
  onCancel?: () => void;
}

const KINDS: { value: PayoutMethodKind; label: string; subtitle: string }[] = [
  { value: "upi", label: "UPI", subtitle: "Most common in India (e.g. yourname@hdfcbank)" },
  { value: "bank_account", label: "Bank account", subtitle: "Account number + IFSC for NEFT/IMPS" },
  { value: "zelle", label: "Zelle", subtitle: "US email or phone number" },
];

export function PayoutMethodForm({ existing, onSaved, onCancel }: PayoutMethodFormProps) {
  const [kind, setKind] = useState<PayoutMethodKind>(existing?.kind ?? "upi");
  const [accountHolderName, setAccountHolderName] = useState(
    existing?.accountHolderName ?? "",
  );
  const [upiId, setUpiId] = useState(existing?.upiId ?? "");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState(existing?.bankIfsc ?? "");
  const [zelleEmail, setZelleEmail] = useState(existing?.zelleEmail ?? "");
  const [zellePhone, setZellePhone] = useState(existing?.zellePhone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const editing = !!existing;
  const editingKindLocked = editing; // can't change kind via PATCH

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const body: Record<string, unknown> = { kind, accountHolderName };
    if (kind === "upi") body.upiId = upiId;
    if (kind === "bank_account") {
      // On edit we only resubmit account number if the user typed a new one;
      // otherwise the encrypted blob already on the row stays put. So if the
      // input is empty in edit mode, we should NOT call PATCH for the bank
      // payload — that would mean "no change". Validation requires the field
      // when kind is bank_account, so prompt the user.
      if (!bankAccountNumber && editing) {
        setError(
          "To edit a bank account, re-enter the full account number (we can't display the saved one).",
        );
        setLoading(false);
        return;
      }
      body.bankAccountNumber = bankAccountNumber;
      body.bankIfsc = bankIfsc;
    }
    if (kind === "zelle") {
      if (zelleEmail) body.zelleEmail = zelleEmail;
      if (zellePhone) body.zellePhone = zellePhone;
    }

    try {
      const url = editing
        ? `/api/writer/payout-methods/${existing!.id}`
        : "/api/writer/payout-methods";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save method");
        return;
      }
      onSaved(data as MaskedPayoutMethod);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label className="mb-2 block">Payout method</Label>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => {
            const active = kind === k.value;
            const disabled = editingKindLocked && k.value !== existing!.kind;
            return (
              <button
                key={k.value}
                type="button"
                disabled={disabled}
                onClick={() => setKind(k.value)}
                className={[
                  "rounded-xl border px-3 py-3 text-left text-sm transition-colors",
                  active
                    ? "border-[#0851A0] bg-[#0851A0]/5 text-[#0851A0]"
                    : "border-gray-200 hover:border-gray-300 text-gray-700",
                  disabled ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                <div className="font-medium">{k.label}</div>
                <div className="text-xs text-gray-500 mt-1">{k.subtitle}</div>
              </button>
            );
          })}
        </div>
        {editingKindLocked && (
          <p className="mt-2 text-xs text-gray-400">
            To change method type, delete this one and add a new one.
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="accountHolderName">Full name on account</Label>
        <Input
          id="accountHolderName"
          value={accountHolderName}
          onChange={(e) => setAccountHolderName(e.target.value)}
          placeholder="As it appears on your bank / UPI account"
          required
          minLength={2}
          maxLength={100}
        />
      </div>

      {kind === "upi" && (
        <div>
          <Label htmlFor="upiId">UPI ID</Label>
          <Input
            id="upiId"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@hdfcbank"
            required
          />
        </div>
      )}

      {kind === "bank_account" && (
        <>
          <div>
            <Label htmlFor="bankAccountNumber">
              Bank account number
              {editing && existing?.bankAccountNumberMasked ? (
                <span className="ml-2 text-xs text-gray-400">
                  (saved: {existing.bankAccountNumberMasked})
                </span>
              ) : null}
            </Label>
            <Input
              id="bankAccountNumber"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value.replace(/\s+/g, ""))}
              placeholder={editing ? "Re-enter to change" : "8–20 digit account number"}
              required={!editing}
            />
            <p className="mt-1 text-xs text-gray-400">
              Encrypted at rest. Only the last 4 digits are visible after save.
            </p>
          </div>
          <div>
            <Label htmlFor="bankIfsc">IFSC code</Label>
            <Input
              id="bankIfsc"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              placeholder="e.g. HDFC0001234"
              maxLength={11}
              required
            />
          </div>
        </>
      )}

      {kind === "zelle" && (
        <>
          <div>
            <Label htmlFor="zelleEmail">Zelle email</Label>
            <Input
              id="zelleEmail"
              type="email"
              value={zelleEmail}
              onChange={(e) => setZelleEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <Label htmlFor="zellePhone">…or US phone</Label>
            <Input
              id="zellePhone"
              type="tel"
              value={zellePhone}
              onChange={(e) => setZellePhone(e.target.value)}
              placeholder="+14155550123"
            />
            <p className="mt-1 text-xs text-gray-400">
              Provide either email or phone (or both).
            </p>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : editing ? "Save changes" : "Save method"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
