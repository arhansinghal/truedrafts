"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Star, Pencil, Trash2 } from "lucide-react";
import { PayoutMethodForm } from "./PayoutMethodForm";
import type { MaskedPayoutMethod } from "@/lib/payout-methods";

interface Props {
  initial: MaskedPayoutMethod[];
}

export function PayoutMethodsManager({ initial }: Props) {
  const router = useRouter();
  const [methods, setMethods] = useState<MaskedPayoutMethod[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(initial.length === 0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function upsertLocal(method: MaskedPayoutMethod) {
    setMethods((prev) => {
      const others = prev.filter((m) => m.id !== method.id);
      if (method.isDefault) {
        others.forEach((m) => (m.isDefault = false));
      }
      return [method, ...others].sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    });
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/writer/payout-methods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to set default");
        return;
      }
      upsertLocal(data as MaskedPayoutMethod);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this payout method?")) return;
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/writer/payout-methods/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete");
        return;
      }
      setMethods((prev) => prev.filter((m) => m.id !== id));
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  const editing = editingId
    ? methods.find((m) => m.id === editingId) ?? null
    : null;

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {methods.map((m) => (
        <div
          key={m.id}
          className="rounded-2xl border border-gray-200 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {labelForKind(m.kind)}
                </span>
                {m.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 text-xs">
                    <Star className="h-3 w-3 fill-current" />
                    Default
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {m.accountHolderName}
              </div>
              <div className="mt-1 text-xs text-gray-500 font-mono">
                {summarize(m)}
              </div>
            </div>
            <div className="flex flex-col gap-2 items-stretch">
              {!m.isDefault && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.id}
                  onClick={() => makeDefault(m.id)}
                >
                  Make default
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === m.id}
                onClick={() => setEditingId(m.id)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                disabled={busyId === m.id}
                onClick={() => remove(m.id)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      ))}

      {!adding && !editing && (
        <Button variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add another payout method
        </Button>
      )}

      {(adding || editing) && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            {editing ? "Edit payout method" : "New payout method"}
          </h3>
          <PayoutMethodForm
            existing={editing}
            onSaved={(method) => {
              upsertLocal(method);
              setAdding(false);
              setEditingId(null);
              router.refresh();
            }}
            onCancel={() => {
              setAdding(false);
              setEditingId(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function labelForKind(kind: MaskedPayoutMethod["kind"]): string {
  if (kind === "upi") return "UPI";
  if (kind === "bank_account") return "Bank account";
  return "Zelle";
}

function summarize(m: MaskedPayoutMethod): string {
  if (m.kind === "upi") return m.upiId ?? "";
  if (m.kind === "bank_account") {
    return `${m.bankAccountNumberMasked ?? ""}${m.bankIfsc ? `  •  ${m.bankIfsc}` : ""}`;
  }
  return m.zelleEmail ?? m.zellePhone ?? "";
}
