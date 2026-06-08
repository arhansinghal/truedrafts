"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { essayTypeLabel } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import type { University } from "@/lib/db/schema";

const ESSAY_TYPES = [
  "common_app",
  "supplemental",
  "why_school",
  "activities",
  "short_answer",
  "other",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const SUGGESTED_PRICES = ["500", "800", "1000", "1500"];

const WORD_LIMIT = 650;

interface EssayUploadFormProps {
  universities: University[];
  initialValues?: {
    id: string;
    title: string;
    universityId: string;
    essayType: string;
    fullContent: string;
    priceCents: number;
    admittedYear: number | null;
  };
  mode?: "create" | "edit";
}

// ─── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center mb-8">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center">
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                done
                  ? "bg-[#0851A0] text-white"
                  : active
                  ? "bg-[#0851A0] text-white ring-4 ring-[#0851A0]/20"
                  : "bg-gray-100 text-gray-400",
              ].join(" ")}
            >
              {done ? <Check className="h-4 w-4" /> : step}
            </div>
            {step < total && (
              <div
                className={[
                  "mx-2 h-0.5 w-12 sm:w-20 transition-colors",
                  done ? "bg-[#0851A0]" : "bg-gray-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
      <span className="ml-4 text-sm text-gray-400">
        Step {current} of {total}
      </span>
    </div>
  );
}

// ─── Select wrapper ────────────────────────────────────────────────────────────

function SelectField({
  id,
  label,
  value,
  onChange,
  required,
  children,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}

// ─── Main form ─────────────────────────────────────────────────────────────────

export function EssayUploadForm({
  universities,
  initialValues,
  mode = "create",
}: EssayUploadFormProps) {
  const router = useRouter();

  // Shared state
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [universityId, setUniversityId] = useState(initialValues?.universityId ?? "");
  const [essayType, setEssayType] = useState(initialValues?.essayType ?? "");
  const [admittedYear, setAdmittedYear] = useState(
    initialValues?.admittedYear ? String(initialValues.admittedYear) : String(CURRENT_YEAR)
  );
  const [content, setContent] = useState(initialValues?.fullContent ?? "");
  const [price, setPrice] = useState(
    initialValues ? String(initialValues.priceCents / 100) : ""
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Step wizard only in create mode
  const [step, setStep] = useState(1);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const earnings = price && !isNaN(parseFloat(price)) ? (parseFloat(price) * 0.5).toFixed(2) : "0.00";
  const selectedUni = universities.find((u) => u.id === universityId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title || !universityId || !essayType || !content || !price) {
      setError("Please fill in all required fields.");
      return;
    }
    const priceCents = Math.round(parseFloat(price) * 100);
    if (isNaN(priceCents) || priceCents < 100) {
      setError("Minimum price is ₹1");
      return;
    }
    setLoading(true);
    try {
      const url =
        mode === "edit"
          ? `/api/writer/essays/${initialValues!.id}`
          : "/api/writer/essays";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          universityId,
          essayType,
          fullContent: content,
          priceCents,
          admittedYear: admittedYear ? parseInt(admittedYear) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save essay.");
      } else {
        router.push("/writer/essays");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Edit mode: show all fields at once ──────────────────────────────────────
  if (mode === "edit") {
    return (
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <Label htmlFor="title">
            Essay title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How I found my passion through robotics"
            className="mt-1"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            id="university"
            label={<>University <span className="text-red-500">*</span></>}
            value={universityId}
            onChange={setUniversityId}
            required
          >
            <option value="">Select university</option>
            {universities.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="type"
            label={<>Essay type <span className="text-red-500">*</span></>}
            value={essayType}
            onChange={setEssayType}
            required
          >
            <option value="">Select type</option>
            {ESSAY_TYPES.map((t) => (
              <option key={t} value={t}>
                {essayTypeLabel(t)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">
              Your price (INR) <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                ₹
              </span>
              <Input
                id="price"
                type="number"
                min="1"
                step="0.50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-7"
                placeholder="9.99"
                required
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              You earn ₹{earnings} per sale
            </p>
          </div>
          <SelectField
            id="year"
            label="Admitted year"
            value={admittedYear}
            onChange={setAdmittedYear}
          >
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </SelectField>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label htmlFor="content">
              Essay content <span className="text-red-500">*</span>
            </Label>
            <span className="text-xs text-gray-400">{wordCount} words</span>
          </div>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your full essay here..."
            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 font-serif text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
            rows={16}
            required
          />
          <p className="mt-1 text-xs text-gray-400">
            The first 25% will be shown as a free preview.
          </p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#0851A0] text-white hover:bg-[#063d85]"
            style={{ background: "#0851A0" }}
          >
            {loading ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  // ── Create mode: 3-step wizard ───────────────────────────────────────────────

  function canAdvanceStep1() {
    return !!universityId && !!essayType && !!admittedYear && !!title;
  }

  function canAdvanceStep2() {
    return content.trim().length > 0;
  }

  return (
    <div className="max-w-2xl">
      <StepIndicator current={step} total={3} />

      <form onSubmit={handleSubmit}>
        {/* ── Step 1: Details ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Essay Details</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Tell us about the essay you&apos;re submitting.
              </p>
            </div>

            <SelectField
              id="university"
              label={<>University <span className="text-red-500">*</span></>}
              value={universityId}
              onChange={setUniversityId}
              required
            >
              <option value="">Select university</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>

            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="type"
                label={<>Essay type <span className="text-red-500">*</span></>}
                value={essayType}
                onChange={setEssayType}
                required
              >
                <option value="">Select type</option>
                {ESSAY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {essayTypeLabel(t)}
                  </option>
                ))}
              </SelectField>

              <SelectField
                id="year"
                label="Admitted year"
                value={admittedYear}
                onChange={setAdmittedYear}
              >
                {YEARS.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <Label htmlFor="title">
                Essay title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. How I found my passion through robotics"
                className="mt-1"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                disabled={!canAdvanceStep1()}
                onClick={() => setStep(2)}
                className="bg-[#0851A0] text-white hover:bg-[#063d85] px-6"
                style={{ background: "#0851A0" }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Essay content ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Write Your Essay</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Paste your full essay. The first 25% will be shown as a free preview.
              </p>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label htmlFor="content">
                  Essay content <span className="text-red-500">*</span>
                </Label>
                <span
                  className={[
                    "text-xs font-medium",
                    wordCount > WORD_LIMIT ? "text-red-500" : "text-gray-400",
                  ].join(" ")}
                >
                  {wordCount} / {WORD_LIMIT} words
                </span>
              </div>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your full essay here..."
                className="w-full resize-y rounded-lg border border-gray-200 bg-white px-4 py-3 font-serif text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                style={{ minHeight: "400px" }}
                required
              />
            </div>

            {/* Collapsible tips */}
            <div className="rounded-lg border border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={() => setShowTips((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-600"
              >
                <span>Tips for a great submission</span>
                <ChevronDown
                  className={[
                    "h-4 w-4 text-gray-400 transition-transform",
                    showTips ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>
              {showTips && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <ul className="space-y-1.5 text-sm text-gray-500">
                    <li>Use the exact version you submitted to the university.</li>
                    <li>Proofread carefully before submitting — you cannot edit after approval.</li>
                    <li>
                      Include the complete essay; partial submissions will be rejected.
                    </li>
                    <li>
                      Common App essays are typically 250–650 words. Supplementals vary.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="px-5"
              >
                ← Back
              </Button>
              <Button
                type="button"
                disabled={!canAdvanceStep2()}
                onClick={() => setStep(3)}
                className="bg-[#0851A0] text-white hover:bg-[#063d85] px-6"
                style={{ background: "#0851A0" }}
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Price & review ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Set Your Price</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Choose a price that reflects the value of your essay.
              </p>
            </div>

            {/* Price input */}
            <div>
              <Label htmlFor="price">
                Price (INR) <span className="text-red-500">*</span>
              </Label>
              <div className="relative mt-1 max-w-[180px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  ₹
                </span>
                <Input
                  id="price"
                  type="number"
                  min="1"
                  step="0.50"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="pl-7"
                  placeholder="9.99"
                  required
                />
              </div>

              {/* Suggested chips */}
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED_PRICES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrice(p)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                      price === p
                        ? "border-[#0851A0] bg-[#e8f1fa] text-[#0851A0]"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                    ].join(" ")}
                  >
                    ₹{p}
                  </button>
                ))}
              </div>

              {/* Earnings preview */}
              {price && !isNaN(parseFloat(price)) && parseFloat(price) > 0 && (
                <p className="mt-2 text-sm font-medium text-[#0851A0]">
                  You&apos;ll earn{" "}
                  <span className="font-bold">₹{earnings}</span> per sale
                </p>
              )}
            </div>

            {/* Review summary */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Review Summary
              </h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-500">Title</span>
                <span className="font-medium text-gray-800 truncate">{title || "—"}</span>

                <span className="text-gray-500">University</span>
                <span className="font-medium text-gray-800">
                  {selectedUni?.name ?? "—"}
                </span>

                <span className="text-gray-500">Essay type</span>
                <span className="font-medium text-gray-800">
                  {essayType ? essayTypeLabel(essayType) : "—"}
                </span>

                <span className="text-gray-500">Word count</span>
                <span className="font-medium text-gray-800">{wordCount} words</span>

                <span className="text-gray-500">Year admitted</span>
                <span className="font-medium text-gray-800">{admittedYear}</span>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                className="px-5"
              >
                ← Back
              </Button>
              <Button
                type="submit"
                disabled={loading || !price}
                className="bg-[#0851A0] text-white hover:bg-[#063d85] px-7"
                style={{ background: "#0851A0" }}
              >
                {loading ? "Submitting…" : "Submit for Review"}
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              Review takes 24–48 hours. You&apos;ll be notified by email once your essay goes live.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
