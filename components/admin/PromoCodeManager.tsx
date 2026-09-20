"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Power, Trash2, Loader2 } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { describeTerms, type PromoScope } from "@/lib/promo";

type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  kind: "percent" | "flat";
  percentOff: number | null;
  flatOffCents: number | null;
  maxDiscountCents: number | null;
  minSubtotalCents: number;
  scope: PromoScope;
  maxRedemptions: number | null;
  maxRedemptionsPerUser: number;
  timesRedeemed: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
  claimedCount: number;
  discountedCents: number;
};

const EMPTY_FORM = {
  code: "",
  description: "",
  kind: "percent" as "percent" | "flat",
  percentOff: "10",
  flatOffCents: "",
  maxDiscountCents: "",
  minSubtotalCents: "",
  scope: "all" as PromoScope,
  maxRedemptions: "",
  maxRedemptionsPerUser: "1",
  startsAt: "",
  endsAt: "",
};

export function PromoCodeManager() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [problems, setProblems] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRows((await res.json()) as PromoRow[]);
    } catch (err) {
      console.error("[admin] promo codes fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        active: acc.active + (row.active ? 1 : 0),
        claimed: acc.claimed + row.claimedCount,
        discounted: acc.discounted + row.discountedCents,
      }),
      { active: 0, claimed: 0, discounted: 0 },
    );
  }, [rows]);

  async function create() {
    setCreating(true);
    setProblems([]);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          description: form.description,
          kind: form.kind,
          percentOff: form.kind === "percent" ? Number(form.percentOff) : null,
          flatOffCents: form.kind === "flat" ? Number(form.flatOffCents) : null,
          maxDiscountCents: form.maxDiscountCents || null,
          minSubtotalCents: form.minSubtotalCents || 0,
          scope: form.scope,
          maxRedemptions: form.maxRedemptions || null,
          maxRedemptionsPerUser: Number(form.maxRedemptionsPerUser || 1),
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
        }),
      });
      const data = (await res.json()) as { problems?: string[]; error?: string };
      if (!res.ok) {
        setProblems(data.problems ?? [data.error ?? "Couldn't create that code."]);
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refresh();
    } catch {
      setProblems(["Couldn't reach the server."]);
    } finally {
      setCreating(false);
    }
  }

  async function toggle(row: PromoRow) {
    setBusyId(row.id);
    try {
      await fetch(`/api/admin/promo-codes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: PromoRow) {
    setBusyId(row.id);
    try {
      await fetch(`/api/admin/promo-codes/${row.id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Promo codes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {totals.active} active · {totals.claimed} claimed ·{" "}
            {formatCents(totals.discounted)} discounted to date
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#0851A0] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          New code
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Code">
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="WELCOME10"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase"
              />
            </Field>

            <Field label="Type">
              <select
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as "percent" | "flat" })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="percent">Percentage off</option>
                <option value="flat">Flat amount off</option>
              </select>
            </Field>

            {form.kind === "percent" ? (
              <Field label="Percent off">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.percentOff}
                  onChange={(e) => setForm({ ...form, percentOff: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
            ) : (
              <Field label="Flat off (paise)">
                <input
                  type="number"
                  min={1}
                  value={form.flatOffCents}
                  onChange={(e) =>
                    setForm({ ...form, flatOffCents: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </Field>
            )}

            <Field label="Max discount (paise, optional)">
              <input
                type="number"
                min={0}
                value={form.maxDiscountCents}
                onChange={(e) =>
                  setForm({ ...form, maxDiscountCents: e.target.value })
                }
                placeholder="uncapped"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Min subtotal (paise)">
              <input
                type="number"
                min={0}
                value={form.minSubtotalCents}
                onChange={(e) =>
                  setForm({ ...form, minSubtotalCents: e.target.value })
                }
                placeholder="0"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Applies to">
              <select
                value={form.scope}
                onChange={(e) =>
                  setForm({ ...form, scope: e.target.value as PromoScope })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="all">Everything</option>
                <option value="applications">Applications only</option>
                <option value="essays">Old essays only</option>
                <option value="bundles">Bundles only</option>
              </select>
            </Field>

            <Field label="Total redemptions (optional)">
              <input
                type="number"
                min={0}
                value={form.maxRedemptions}
                onChange={(e) =>
                  setForm({ ...form, maxRedemptions: e.target.value })
                }
                placeholder="unlimited"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Per buyer">
              <input
                type="number"
                min={1}
                value={form.maxRedemptionsPerUser}
                onChange={(e) =>
                  setForm({ ...form, maxRedemptionsPerUser: e.target.value })
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Ends at (optional)">
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>

          <Field label="Internal note">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Reddit launch campaign"
              className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>

          {problems.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-lg bg-red-50 p-3 text-xs text-red-600">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0851A0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setProblems([]);
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Terms</th>
              <th className="px-4 py-3 text-right">Claimed</th>
              <th className="px-4 py-3 text-right">Redeemed</th>
              <th className="px-4 py-3 text-right">Discounted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No promo codes yet.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <div className="font-mono font-semibold text-gray-900">
                    {row.code}
                  </div>
                  {row.description && (
                    <div className="mt-0.5 text-xs text-gray-400">
                      {row.description}
                    </div>
                  )}
                  {!row.active && (
                    <span className="mt-1 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                      paused
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {describeTerms({
                    ...row,
                    startsAt: row.startsAt ? new Date(row.startsAt) : null,
                    endsAt: row.endsAt ? new Date(row.endsAt) : null,
                  })}
                  {row.endsAt && (
                    <div className="mt-0.5 text-xs text-gray-400">
                      ends {new Date(row.endsAt).toLocaleDateString("en-GB")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {row.claimedCount}
                  {row.maxRedemptions !== null && ` / ${row.maxRedemptions}`}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                  {row.timesRedeemed}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                  {formatCents(row.discountedCents)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void toggle(row)}
                      disabled={busyId === row.id}
                      title={row.active ? "Pause" : "Resume"}
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      disabled={busyId === row.id}
                      title="Delete"
                      className="rounded-lg border border-gray-200 p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}
