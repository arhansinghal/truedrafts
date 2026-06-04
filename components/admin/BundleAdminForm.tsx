"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/utils";
import type { Bundle } from "@/lib/db/schema";
import type { BundleRule } from "@/lib/bundles";
import { Package, Sparkles, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";

interface PickerApp {
  id: string;
  title: string;
  slug: string;
  priceCents: number;
  admittedYear: number | null;
  university: { id: string; name: string; slug: string };
}

interface PreviewResult {
  members: PickerApp[];
  pricing: { sumPrices: number; finalPrice: number; savings: number; savingsPercent: number };
}

interface Props {
  initial?: Bundle | null;
}

export function BundleAdminForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? "");
  const [kind, setKind] = useState<"static" | "rule">(initial?.kind ?? "static");
  const [applicationIds, setApplicationIds] = useState<string[]>(initial?.applicationIds ?? []);
  const [rule, setRule] = useState<BundleRule>(() => {
    if (!initial?.ruleConfig) return {};
    try { return JSON.parse(initial.ruleConfig); } catch { return {}; }
  });
  const [pricingMode, setPricingMode] = useState<"flat" | "percent">(initial?.pricingMode ?? "percent");
  const [flatPriceDollars, setFlatPriceDollars] = useState<string>(
    initial?.flatPriceCents != null ? (initial.flatPriceCents / 100).toFixed(2) : "",
  );
  const [discountPercent, setDiscountPercent] = useState<string>(
    initial?.discountPercent != null ? String(initial.discountPercent) : "20",
  );
  const [startsAt, setStartsAt] = useState<string>(
    initial?.startsAt ? toDateInput(initial.startsAt) : "",
  );
  const [endsAt, setEndsAt] = useState<string>(initial?.endsAt ? toDateInput(initial.endsAt) : "");

  const [picker, setPicker] = useState<PickerApp[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the application picker once
  useEffect(() => {
    fetch("/api/admin/bundles/applications")
      .then((r) => r.json())
      .then((d) => setPicker(d.applications ?? []))
      .catch(() => {});
  }, []);

  // Re-preview whenever the bundle config changes
  useEffect(() => {
    const flat = parseFloat(flatPriceDollars);
    const pct = parseInt(discountPercent, 10);
    const body = {
      kind,
      applicationIds,
      ruleConfig: kind === "rule" ? rule : undefined,
      pricingMode,
      flatPriceCents: pricingMode === "flat" && !isNaN(flat) ? Math.round(flat * 100) : undefined,
      discountPercent: pricingMode === "percent" && !isNaN(pct) ? pct : undefined,
    };
    let cancelled = false;
    fetch("/api/admin/bundles/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPreview(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [kind, applicationIds, rule, pricingMode, flatPriceDollars, discountPercent]);

  function buildPayload() {
    const flat = parseFloat(flatPriceDollars);
    const pct = parseInt(discountPercent, 10);
    return {
      title: title.trim(),
      description: description.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      kind,
      applicationIds: kind === "static" ? applicationIds : [],
      ruleConfig: kind === "rule" ? rule : null,
      pricingMode,
      flatPriceCents: pricingMode === "flat" && !isNaN(flat) ? Math.round(flat * 100) : null,
      discountPercent: pricingMode === "percent" && !isNaN(pct) ? pct : null,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
    };
  }

  function save(thenPublish = false) {
    setError(null);
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    startTransition(async () => {
      const url = isEdit ? `/api/admin/bundles/${initial!.id}` : "/api/admin/bundles";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      const id = isEdit ? initial!.id : data.bundle.id;
      if (thenPublish) {
        const pub = await fetch(`/api/admin/bundles/${id}/publish`, { method: "POST" });
        const pubData = await pub.json();
        if (!pub.ok) {
          setError(pubData.error ?? "Publish failed");
          router.push(`/admin/bundles/${id}`);
          router.refresh();
          return;
        }
      }
      router.push("/admin/bundles");
      router.refresh();
    });
  }

  async function archive() {
    if (!isEdit) return;
    if (!confirm("Archive this bundle? Existing buyers keep access.")) return;
    startTransition(async () => {
      await fetch(`/api/admin/bundles/${initial!.id}/archive`, { method: "POST" });
      router.push("/admin/bundles");
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: form */}
      <div className="lg:col-span-2 space-y-6">
        <Section title="Identity">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Ivy League Bundle"
            />
          </Field>
          <Field label="Description (optional)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown on the bundle detail page"
              rows={3}
            />
          </Field>
          <Field label="Cover image URL (optional)">
            <Input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </Section>

        <Section title="Membership">
          <div className="flex gap-2 mb-4">
            <KindToggle active={kind === "static"} onClick={() => setKind("static")}>
              Static (hand-picked)
            </KindToggle>
            <KindToggle active={kind === "rule"} onClick={() => setKind("rule")}>
              Rule-based (auto)
            </KindToggle>
          </div>

          {kind === "static" ? (
            <ApplicationPicker
              all={picker}
              selected={applicationIds}
              onToggle={(id) =>
                setApplicationIds((prev) =>
                  prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
              search={pickerSearch}
              onSearch={setPickerSearch}
            />
          ) : (
            <RuleBuilder rule={rule} onChange={setRule} />
          )}
        </Section>

        <Section title="Pricing">
          <div className="flex gap-2 mb-4">
            <KindToggle active={pricingMode === "percent"} onClick={() => setPricingMode("percent")}>
              % discount
            </KindToggle>
            <KindToggle active={pricingMode === "flat"} onClick={() => setPricingMode("flat")}>
              Flat price
            </KindToggle>
          </div>
          {pricingMode === "percent" ? (
            <Field label="Discount %">
              <Input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Flat price (USD)">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={flatPriceDollars}
                onChange={(e) => setFlatPriceDollars(e.target.value)}
                placeholder="49.99"
              />
            </Field>
          )}
        </Section>

        <Section title="Schedule (optional)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Field>
            <Field label="Ends">
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Field>
          </div>
        </Section>
      </div>

      {/* Right: live preview / actions */}
      <div className="space-y-4">
        <div className="sticky top-4 space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-[#f5f9ff] to-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-[#0851A0]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0851A0]">
                Live preview
              </span>
            </div>
            {preview ? (
              <>
                <div className="mb-3">
                  <div className="text-xs text-gray-500">Resolves to</div>
                  <div className="text-sm font-semibold text-gray-900">
                    {preview.members.length} application{preview.members.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-gray-500">Sum of prices</div>
                  <div className="text-sm text-gray-700 line-through">
                    {formatCents(preview.pricing.sumPrices)}
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-xs text-gray-500">Bundle price</div>
                  <div className="text-2xl font-bold text-[#0851A0]">
                    {formatCents(preview.pricing.finalPrice)}
                  </div>
                  <div className="text-[11px] text-green-700 font-medium">
                    Save {formatCents(preview.pricing.savings)} ({preview.pricing.savingsPercent}%)
                  </div>
                </div>
                {preview.members.length > 0 && (
                  <div className="border-t border-blue-100 pt-3 mt-3">
                    <div className="text-[11px] text-gray-500 uppercase mb-1.5">Members</div>
                    <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {preview.members.map((m) => (
                        <li key={m.id} className="text-xs text-gray-700 flex justify-between gap-2">
                          <span className="truncate">
                            {m.university.name} — {m.title}
                          </span>
                          <span className="text-gray-400 shrink-0">{formatCents(m.priceCents)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-gray-400">Calculating…</div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Button onClick={() => save(true)} disabled={pending} className="w-full">
              <CheckCircle2 className="h-4 w-4" />
              {isEdit ? "Save & republish" : "Save & publish"}
            </Button>
            <Button onClick={() => save(false)} disabled={pending} variant="outline" className="w-full">
              {isEdit ? "Save changes (keep status)" : "Save as draft"}
            </Button>
            {isEdit && initial!.status !== "archived" && (
              <Button onClick={archive} disabled={pending} variant="ghost" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Archive bundle
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 uppercase font-semibold mb-1">
              <Package className="h-3 w-3" /> Status
            </div>
            <div className="text-sm font-medium text-gray-900 capitalize">
              {initial?.status ?? "new (will save as draft)"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-gray-600 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function KindToggle({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[#0851A0] bg-[#0851A0] text-white"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
      }`}
    >
      {children}
    </button>
  );
}

function ApplicationPicker({
  all, selected, onToggle, search, onSearch,
}: {
  all: PickerApp[];
  selected: string[];
  onToggle: (id: string) => void;
  search: string;
  onSearch: (q: string) => void;
}) {
  const filtered = search
    ? all.filter(
        (a) =>
          a.title.toLowerCase().includes(search.toLowerCase()) ||
          a.university.name.toLowerCase().includes(search.toLowerCase()),
      )
    : all;
  return (
    <div>
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Filter by title or university…"
        className="mb-3"
      />
      <div className="text-[11px] text-gray-500 mb-2">
        {selected.length} selected · {filtered.length} shown
      </div>
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtered.map((a) => {
          const checked = selected.includes(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onToggle(a.id)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 transition-colors ${
                checked ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                  checked ? "bg-[#0851A0] border-[#0851A0]" : "border-gray-300"
                }`}
              >
                {checked && <span className="text-white text-[10px]">✓</span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-900 truncate">{a.title}</div>
                <div className="text-[11px] text-gray-500">
                  {a.university.name}
                  {a.admittedYear ? ` · ${a.admittedYear}` : ""}
                </div>
              </div>
              <span className="text-xs font-medium text-[#0851A0] shrink-0">
                {formatCents(a.priceCents)}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-6 text-center text-xs text-gray-400">No matches</div>
        )}
      </div>
    </div>
  );
}

function RuleBuilder({ rule, onChange }: { rule: BundleRule; onChange: (r: BundleRule) => void }) {
  function set<K extends keyof BundleRule>(k: K, v: BundleRule[K] | undefined) {
    const next: BundleRule = { ...rule };
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
      delete next[k];
    } else {
      next[k] = v;
    }
    onChange(next);
  }
  return (
    <div className="space-y-3">
      <Field label="University type">
        <select
          className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
          value={rule.universityType ?? ""}
          onChange={(e) => set("universityType", (e.target.value || undefined) as BundleRule["universityType"])}
        >
          <option value="">Any</option>
          <option value="ivy">Ivy</option>
          <option value="public_flagship">Public flagship</option>
          <option value="private_research">Private research</option>
          <option value="liberal_arts">Liberal arts</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Region">
        <select
          className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 text-sm"
          value={rule.region ?? ""}
          onChange={(e) => set("region", (e.target.value || undefined) as BundleRule["region"])}
        >
          <option value="">Any</option>
          <option value="northeast">Northeast</option>
          <option value="south">South</option>
          <option value="midwest">Midwest</option>
          <option value="west">West</option>
          <option value="mid_atlantic">Mid-Atlantic</option>
        </select>
      </Field>
      <Field label="Admitted year">
        <Input
          type="number"
          value={rule.admittedYear ?? ""}
          onChange={(e) =>
            set("admittedYear", e.target.value ? parseInt(e.target.value, 10) : undefined)
          }
          placeholder="2024"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min price (USD)">
          <Input
            type="number"
            step="0.01"
            value={rule.minPriceCents != null ? (rule.minPriceCents / 100).toFixed(2) : ""}
            onChange={(e) =>
              set("minPriceCents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)
            }
          />
        </Field>
        <Field label="Max price (USD)">
          <Input
            type="number"
            step="0.01"
            value={rule.maxPriceCents != null ? (rule.maxPriceCents / 100).toFixed(2) : ""}
            onChange={(e) =>
              set("maxPriceCents", e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)
            }
          />
        </Field>
      </div>
      <Field label="Tags (any-of, comma-separated)">
        <Input
          value={(rule.tagsAny ?? []).join(", ")}
          onChange={(e) =>
            set(
              "tagsAny",
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          placeholder="stem, leadership"
        />
      </Field>
    </div>
  );
}

function toDateInput(d: Date | string): string {
  const date = new Date(d);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
