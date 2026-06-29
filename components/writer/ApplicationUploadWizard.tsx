"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, CheckCircle, ChevronDown, Upload, X, ImageIcon, Save, Plus, Trash2 } from "lucide-react";
import type { University } from "@/lib/db/schema";
import { COMMON_APP_PROMPTS, COMMON_APP_WORD_LIMIT } from "@/lib/common-app";

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const STEP_LABELS = ["Application Setup", "Common App Essay", "Supplemental Essays", "Profile & Major", "Review & Submit"];

// Writer's pledge shown on the Review & Submit step. Preserves the substance of
// every disclaimer item — including the bundle-inclusion consent, which is
// legally stamped (users.writersAgreedBundlesAt) when the writer agrees.
const PLEDGE_ITEMS = [
  "These essays are my own original work, written for my college application.",
  "I was genuinely admitted to the university listed above.",
  "I won't submit work written by someone else or AI-generated content.",
  "I understand TrueDrafts reviews every submission before it goes live (24–48h), and that misrepresentation means permanent removal.",
  "I allow TrueDrafts to include my application in curated bundle deals (e.g. “Ivy League Pack”), with bundle proceeds shared pro-rata across the included applications at the same rate as an individual sale.",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplementalEntry {
  prompt: string;
  content: string;
}

interface ProfileEntry {
  name: string;
  description: string;
}

interface WizardData {
  // Step 1
  universityId: string;
  admittedYear: string;
  submittedCommonApp: boolean;
  numSupplementals: number;
  admissionProof: string;
  // Step 2
  caPromptIndex: number;
  caContent: string;
  caScreenshot: string;
  // True when this draft came from a PDF import — the uploaded Common App PDF is
  // already proof, so the Common App screenshot isn't required.
  pdfImported: boolean;
  // Step 3
  supplementals: SupplementalEntry[];
  // Step 4 — Profile & Major (intendedMajor is application-level;
  // activities/honors are the writer's profile-level lists, editable here)
  intendedMajor: string;
  activities: ProfileEntry[];
  honors: ProfileEntry[];
  // Step 5
  disclaimerChecked: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current, totalSteps }: { current: number; totalSteps: number }) {
  return (
    <div className="mb-10">
      <div className="flex items-center">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                    done ? "bg-[#0851A0] text-white" : active ? "bg-[#0851A0] text-white ring-4 ring-[#0851A0]/20" : "bg-gray-100 text-gray-400",
                  ].join(" ")}
                >
                  {done ? <Check className="h-4 w-4" /> : step}
                </div>
                <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-[#0851A0]" : done ? "text-gray-500" : "text-gray-300"}`}>
                  {STEP_LABELS[i]}
                </span>
              </div>
              {step < totalSteps && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${done ? "bg-[#0851A0]" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageUpload({
  label, hint, value, onChange,
}: {
  label: React.ReactNode; hint?: string; value: string; onChange: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    const b64 = await fileToBase64(file);
    onChange(b64);
  }

  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}
      {value ? (
        <div className="relative rounded-xl border border-[#0851A0]/20 bg-[#e8f1fa] p-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
            {value.startsWith("data:image") ? (
              <img src={value} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <span className="text-sm text-[#0851A0] font-medium flex-1">File uploaded ✓</span>
          <button type="button" onClick={() => onChange("")} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) await handleFile(f); }}
          className={[
            "cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            dragging ? "border-[#0851A0] bg-[#e8f1fa]" : "border-gray-200 hover:border-[#0851A0]/40 hover:bg-gray-50",
          ].join(" ")}
        >
          <Upload className="w-6 h-6 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 font-medium">Click or drag to upload</p>
          <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, or PDF</p>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); }} />
        </div>
      )}
    </div>
  );
}

function EssayTextarea({ value, onChange, wordLimit, placeholder, rows = 14 }: {
  value: string; onChange: (v: string) => void; wordLimit?: number; placeholder?: string; rows?: number;
}) {
  const words = countWords(value);
  const over = wordLimit ? words > wordLimit : false;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label>Essay text <span className="text-red-500">*</span></Label>
        <span className={`text-xs font-medium tabular-nums ${over ? "text-red-500" : "text-gray-400"}`}>
          {words}{wordLimit ? ` / ${wordLimit} words` : " words"}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Paste your essay here…"}
        rows={rows}
        className={[
          "w-full resize-y rounded-xl border px-4 py-3 font-serif text-sm leading-relaxed placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0] transition-colors",
          over ? "border-red-300 bg-red-50/30" : "border-gray-200 bg-white",
        ].join(" ")}
      />
      {over && wordLimit && <p className="text-xs text-red-500 mt-1">{words - wordLimit} words over the limit</p>}
    </div>
  );
}

function SelectField({ id, label, value, onChange, children, required }: {
  id: string; label: React.ReactNode; value: string; onChange: (v: string) => void; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}
          className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}

function StepCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// Save status badge
function SaveBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
      status === "saving" ? "bg-gray-100 text-gray-500" :
      status === "saved" ? "bg-[#e8f1fa] text-[#0851A0]" :
      "bg-red-50 text-red-500"
    }`}>
      {status === "saving" && <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {status === "saved" && <Check className="w-3 h-3" />}
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save failed"}
    </div>
  );
}

// Numbered name + description list editor (activities / honors), styled to
// match the writer profile page's Activities card.
function ProfileListEditor({
  items,
  onChange,
  namePlaceholder,
  descPlaceholder,
  addLabel,
}: {
  items: ProfileEntry[];
  onChange: (next: ProfileEntry[]) => void;
  namePlaceholder: string;
  descPlaceholder: string;
  addLabel: string;
}) {
  const wc = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  return (
    <div className="space-y-2.5">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="w-5 text-xs font-semibold text-[#0851A0]">{String(i + 1).padStart(2, "0")}</span>
            <input
              value={it.name}
              placeholder={namePlaceholder}
              onChange={(e) => onChange(items.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
              className="h-8 flex-1 rounded-md border border-gray-200 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="shrink-0 text-gray-400 hover:text-red-500"
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={it.description}
            placeholder={descPlaceholder}
            rows={2}
            onChange={(e) => {
              if (wc(e.target.value) > 100) return;
              onChange(items.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)));
            }}
            className="w-full resize-none rounded-md border border-gray-200 px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
          />
          <div className="mt-0.5 text-right text-[11px] text-gray-400">{wc(it.description)}/100 words</div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { name: "", description: "" }])}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#0851A0] hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </button>
    </div>
  );
}

// ─── Main wizard ───────────────────────────────────────────────────────────────

const DEFAULT_DATA: WizardData = {
  universityId: "",
  admittedYear: String(CURRENT_YEAR),
  submittedCommonApp: true,
  numSupplementals: 1,
  admissionProof: "",
  caPromptIndex: -1,
  caContent: "",
  caScreenshot: "",
  pdfImported: false,
  supplementals: [{ prompt: "", content: "" }],
  intendedMajor: "",
  activities: [],
  honors: [],
  disclaimerChecked: false,
};

export function ApplicationUploadWizard({
  universities,
  draftId: initialDraftId,
  initialData,
  initialStep,
}: {
  universities: University[];
  draftId?: string;
  initialData?: Partial<WizardData>;
  initialStep?: number;
}) {
  const router = useRouter();

  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [step, setStep] = useState(initialStep ?? 1);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Wizard state
  const [d, setD] = useState<WizardData>({ ...DEFAULT_DATA, ...initialData });

  const set = useCallback(<K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setD((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Sync supplemental array length
  function updateNumSupplementals(n: number) {
    set("numSupplementals", n);
    setD((prev) => {
      const arr = prev.supplementals;
      if (n > arr.length) return { ...prev, numSupplementals: n, supplementals: [...arr, ...Array.from({ length: n - arr.length }, () => ({ prompt: "", content: "" }))] };
      return { ...prev, numSupplementals: n, supplementals: arr.slice(0, n) };
    });
  }

  function updateSupplemental(index: number, field: keyof SupplementalEntry, value: string) {
    setD((prev) => ({
      ...prev,
      supplementals: prev.supplementals.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  }

  const selectedUni = universities.find((u) => u.id === d.universityId);

  // Table-of-contents list for the Review & Submit step.
  const reviewEssays = [
    ...(d.submittedCommonApp
      ? [{
          kind: "Common App essay",
          label: d.caPromptIndex >= 0 ? `Prompt ${d.caPromptIndex + 1} · Personal statement` : "Personal statement",
          words: countWords(d.caContent),
        }]
      : []),
    ...d.supplementals.map((s, i) => ({
      kind: "Supplemental",
      label: (s.prompt && s.prompt.trim()) || `Supplemental ${i + 1}`,
      words: countWords(s.content),
    })),
  ];
  const totalReviewEssays = reviewEssays.length;

  // ── Save draft ──────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (currentStep: number, data: WizardData) => {
    setSaveStatus("saving");
    try {
      const selectedU = universities.find((u) => u.id === data.universityId);
      const payload = {
        universityId: data.universityId || null,
        universityName: selectedU?.name ?? null,
        universitySlug: selectedU?.slug ?? null,
        currentStep,
        data,
      };

      let savedDraftId = draftId;

      if (!savedDraftId) {
        const res = await fetch("/api/writer/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
        const created = await res.json();
        savedDraftId = created.id;
        setDraftId(created.id);
        // Update URL without reload
        window.history.replaceState({}, "", `/writer/essays/new?draft=${created.id}`);
      } else {
        const res = await fetch(`/api/writer/drafts/${savedDraftId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error();
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [draftId, universities]);

  // Step validity. Step 4 (Profile & Major) is optional — no validity gate.
  const step1Valid = !!d.universityId && !!d.admissionProof;
  const step2Valid = !d.submittedCommonApp || (d.caPromptIndex >= 0 && d.caContent.trim().length > 0 && (d.pdfImported || !!d.caScreenshot));
  const step3Valid = d.supplementals.every((s) => s.prompt.trim().length > 0 && s.content.trim().length > 0);
  const step5Valid = d.disclaimerChecked;

  async function saveAndContinue(nextStep?: number) {
    await saveDraft(step, d);
    if (nextStep !== undefined) setStep(nextStep);
  }

  function goNext() {
    const next =
      step === 1 ? (d.submittedCommonApp ? 2 : 3)
      : step === 2 ? 3
      : step === 3 ? 4
      : step === 4 ? 5
      : 5;
    saveAndContinue(next);
  }

  function goBack() {
    const prev =
      step === 5 ? 4
      : step === 4 ? 3
      : step === 3 ? (d.submittedCommonApp ? 2 : 1)
      : step === 2 ? 1
      : 1;
    setStep(prev);
  }

  // ── Submit application as one unit ─────────────────────────────────────────
  async function handleSubmit() {
    setError("");
    if (!step5Valid) return;
    setLoading(true);
    try {
      const cleanProfile = (list: ProfileEntry[]) =>
        list.map((e) => ({ name: e.name.trim(), description: (e.description ?? "").trim() })).filter((e) => e.name);
      const res = await fetch("/api/writer/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: d.universityId,
          admittedYear: parseInt(d.admittedYear),
          admissionProofUrl: d.admissionProof,
          submittedCommonApp: d.submittedCommonApp,
          commonAppPrompt: d.caPromptIndex >= 0 ? COMMON_APP_PROMPTS[d.caPromptIndex] : null,
          commonAppContent: d.caContent || null,
          commonAppScreenshotUrl: d.caScreenshot || null,
          supplementals: d.supplementals,
          numSupplementals: d.numSupplementals,
          major: d.intendedMajor.trim() || null,
          activities: cleanProfile(d.activities),
          honors: cleanProfile(d.honors),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to submit application");
      }
      // Delete draft on successful submit
      if (draftId) {
        await fetch(`/api/writer/drafts/${draftId}`, { method: "DELETE" }).catch(() => {});
      }
      router.push("/writer/essays/submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // ── Nav row ─────────────────────────────────────────────────────────────────
  function NavRow({ onBack, nextDisabled, isSubmit }: { onBack?: () => void; nextDisabled?: boolean; isSubmit?: boolean }) {
    return (
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          {onBack && <Button type="button" variant="outline" onClick={onBack} className="px-5">← Back</Button>}
          <Button
            type="button"
            variant="ghost"
            onClick={() => saveDraft(step, d)}
            className="gap-2 text-gray-500"
          >
            <Save className="w-4 h-4" /> Save progress
          </Button>
          <SaveBadge status={saveStatus} />
        </div>
        <Button
          type="button"
          onClick={isSubmit ? handleSubmit : goNext}
          disabled={nextDisabled || loading}
          className="bg-[#0851A0] text-white hover:bg-[#063d85] px-7"
          style={{ background: "#0851A0" }}
        >
          {loading ? "Submitting…" : isSubmit ? "Submit for Review" : "Save & Continue →"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <StepIndicator current={step} totalSteps={5} />

      {/* ── Step 1: Application Setup ── */}
      {step === 1 && (
        <StepCard title="Application Setup" subtitle="Tell us about the university you got into.">
          <SelectField id="university" label={<>University you were admitted to <span className="text-red-500">*</span></>}
            value={d.universityId} onChange={(v) => set("universityId", v)} required>
            <option value="">Select university</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </SelectField>

          {selectedUni && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e8f1fa] border border-[#0851A0]/10">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                <Image src={`/uni_logos/${selectedUni.slug}.png`} alt={selectedUni.name} width={32} height={32} className="object-contain p-0.5" />
              </div>
              <span className="text-sm font-semibold text-[#0851A0]">{selectedUni.name}</span>
            </div>
          )}

          <SelectField id="year" label="Year admitted" value={d.admittedYear} onChange={(v) => set("admittedYear", v)}>
            {YEARS.map((y) => <option key={y} value={String(y)}>{y}</option>)}
          </SelectField>

          <div>
            <Label className="mb-2 block">Did you submit a Common App? <span className="text-red-500">*</span></Label>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <button key={String(val)} type="button" onClick={() => set("submittedCommonApp", val)}
                  className={["flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                    d.submittedCommonApp === val ? "border-[#0851A0] bg-[#e8f1fa] text-[#0851A0]" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  ].join(" ")}>
                  {val ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="num-sup" className="mb-1.5 block">How many supplemental essays did you submit?</Label>
            <div className="flex items-center gap-4">
              <input id="num-sup" type="range" min={1} max={10} value={d.numSupplementals}
                onChange={(e) => updateNumSupplementals(parseInt(e.target.value))}
                className="flex-1 accent-[#0851A0]" />
              <span className="w-8 text-center text-xl font-bold text-[#0851A0]">{d.numSupplementals}</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5"><span>1</span><span>10</span></div>
          </div>

          <ImageUpload
            label={<>Proof of Admission <span className="text-red-500">*</span></>}
            hint="Upload a screenshot or photo of your admission letter or decision letter."
            value={d.admissionProof} onChange={(v) => set("admissionProof", v)}
          />

          <NavRow nextDisabled={!step1Valid} />
        </StepCard>
      )}

      {/* ── Step 2: Common App Essay ── */}
      {step === 2 && (
        <StepCard title="Common App Essay" subtitle="Paste the essay you submitted to the Common App.">
          <div>
            <Label htmlFor="ca-prompt" className="mb-1.5 block">Which prompt did you respond to? <span className="text-red-500">*</span></Label>
            <div className="relative">
              <select id="ca-prompt" value={d.caPromptIndex === -1 ? "" : String(d.caPromptIndex)}
                onChange={(e) => set("caPromptIndex", parseInt(e.target.value))}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]">
                <option value="">Select a prompt</option>
                {COMMON_APP_PROMPTS.map((p, i) => (
                  <option key={i} value={i}>Prompt {i + 1}: {p.slice(0, 85)}…</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
            {d.caPromptIndex >= 0 && (
              <div className="mt-3 rounded-xl bg-[#f0f5ff] border border-[#0851A0]/10 p-4 text-sm text-gray-600 leading-relaxed italic font-serif">
                {COMMON_APP_PROMPTS[d.caPromptIndex]}
              </div>
            )}
          </div>

          <EssayTextarea value={d.caContent} onChange={(v) => set("caContent", v)} wordLimit={COMMON_APP_WORD_LIMIT} placeholder="Paste your Common App essay here…" />

          {d.pdfImported ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#0851A0]/15 bg-[#e8f1fa] px-4 py-3">
              <Check className="h-4 w-4 shrink-0 text-[#0851A0]" />
              <p className="text-sm text-[#0851A0]">
                Verified from your uploaded Common App PDF — no screenshot needed.
              </p>
            </div>
          ) : (
            <ImageUpload label={<>Common App Submission Screenshot <span className="text-red-500">*</span></>}
              hint="Upload a screenshot of your Common App PDF showing the submitted essay."
              value={d.caScreenshot} onChange={(v) => set("caScreenshot", v)} />
          )}

          <NavRow onBack={goBack} nextDisabled={!step2Valid} />
        </StepCard>
      )}

      {/* ── Step 3: Supplemental Essays ── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Supplemental Essays</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter each of your {d.numSupplementals} supplemental essay{d.numSupplementals !== 1 ? "s" : ""} below.
            </p>
          </div>

          {d.supplementals.map((s, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[#e8f1fa] text-[#0851A0] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                <h3 className="font-semibold text-gray-800">Supplemental Essay {i + 1}</h3>
              </div>
              <div>
                <Label className="mb-1.5 block">Essay prompt <span className="text-red-500">*</span></Label>
                <textarea value={s.prompt} onChange={(e) => updateSupplemental(i, "prompt", e.target.value)}
                  placeholder="Paste the prompt here, e.g. 'Why [University]?'" rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0]" />
              </div>
              <EssayTextarea value={s.content} onChange={(v) => updateSupplemental(i, "content", v)}
                placeholder="Paste your supplemental essay here…" rows={10} />
            </div>
          ))}

          <div className="rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
            <NavRow onBack={goBack} nextDisabled={!step3Valid} />
          </div>
        </div>
      )}

      {/* ── Step 4: Profile & Major (optional) ── */}
      {step === 4 && (
        <StepCard
          title="Profile & Major"
          subtitle="Optional — your intended major shows on this application; activities and honors appear on your writer profile. Skip anytime."
        >
          <div>
            <Label htmlFor="major" className="mb-1.5 block">
              Intended major <span className="font-normal text-gray-400">(optional)</span>
            </Label>
            <input
              id="major"
              value={d.intendedMajor}
              onChange={(e) => set("intendedMajor", e.target.value)}
              placeholder="e.g. Computer Science"
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
            />
          </div>
          <div>
            <Label className="mb-2 block">
              Activities <span className="font-normal text-gray-400">(shown on your writer profile)</span>
            </Label>
            <ProfileListEditor
              items={d.activities}
              onChange={(v) => set("activities", v)}
              namePlaceholder="Position — Organization"
              descPlaceholder="Brief description (max 100 words)…"
              addLabel="Add activity"
            />
          </div>
          <div>
            <Label className="mb-2 block">
              Honors &amp; awards <span className="font-normal text-gray-400">(shown on your writer profile)</span>
            </Label>
            <ProfileListEditor
              items={d.honors}
              onChange={(v) => set("honors", v)}
              namePlaceholder="Honor / award"
              descPlaceholder="Brief description (optional)…"
              addLabel="Add honor"
            />
          </div>
          <NavRow onBack={goBack} />
        </StepCard>
      )}

      {/* ── Step 5: Review & Submit ── */}
      {step === 5 && (
        <div className="anim-in mx-auto max-w-2xl">
          <div
            className="rounded-[14px] p-7"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow)" }}
          >
            <div className="eyebrow mb-2">Step 5</div>
            <h2 className="serif text-[24px] font-semibold" style={{ color: "var(--ink)", letterSpacing: "-.01em" }}>
              Review &amp; submit
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
              Confirm your details and agree to our terms.
            </p>

            <div className="mt-[22px] flex flex-col gap-5">
              {/* Application summary — a table of contents */}
              <div style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden" }}>
                <div
                  className="flex items-center gap-[13px]"
                  style={{ padding: "16px 18px", borderBottom: "1px solid var(--line-soft)" }}
                >
                  <div
                    className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
                    style={{ background: "#fff", border: "1px solid var(--line)" }}
                  >
                    {selectedUni ? (
                      <Image src={`/uni_logos/${selectedUni.slug}.png`} alt={selectedUni.name} width={34} height={34} className="h-[76%] w-[76%] object-contain" />
                    ) : (
                      <span style={{ width: 42, height: 42, borderRadius: 10, background: "var(--paper-2)" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold" style={{ color: "var(--ink)" }}>{selectedUni?.name ?? "—"}</div>
                    <div className="eyebrow mt-[3px]">
                      Class of {d.admittedYear} · {totalReviewEssays} essay{totalReviewEssays !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{ background: "var(--emerald-wash)", color: "var(--emerald)" }}
                  >
                    <CheckCircle className="h-3 w-3" /> Ready
                  </span>
                </div>
                <div style={{ padding: "4px 18px" }}>
                  {reviewEssays.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-[13px]"
                      style={{ padding: "12px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}
                    >
                      <span className="mono shrink-0 text-[12px] font-semibold" style={{ color: "var(--td-blue)", width: 18 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{e.label}</div>
                        <div className="eyebrow mt-0.5">{e.kind}</div>
                      </div>
                      <span
                        className="mono shrink-0 text-[12.5px]"
                        style={{ color: e.words ? "var(--ink-faint)" : "var(--amber)" }}
                      >
                        {e.words ? `${e.words} words` : "empty"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Profile & major summary */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]" style={{ color: "var(--ink-soft)" }}>
                <span><span style={{ color: "var(--ink-faint)" }}>Major:</span>{" "}
                  <strong style={{ color: "var(--ink)" }}>{d.intendedMajor.trim() || "—"}</strong></span>
                <span><span style={{ color: "var(--ink-faint)" }}>Activities:</span>{" "}
                  <strong style={{ color: "var(--ink)" }}>{d.activities.filter((a) => a.name.trim()).length}</strong></span>
                <span><span style={{ color: "var(--ink-faint)" }}>Honors:</span>{" "}
                  <strong style={{ color: "var(--ink)" }}>{d.honors.filter((h) => h.name.trim()).length}</strong></span>
              </div>

              {/* Writer's pledge */}
              <div>
                <div className="eyebrow mb-[13px]">Your writer&apos;s pledge</div>
                <div className="flex flex-col gap-3">
                  {PLEDGE_ITEMS.map((t, i) => (
                    <div key={i} className="flex items-start gap-[11px]">
                      <CheckCircle className="mt-px h-[18px] w-[18px] shrink-0" style={{ color: "var(--emerald)" }} />
                      <span className="text-[13.5px] leading-[1.5]" style={{ color: "var(--ink-soft)" }}>{t}</span>
                    </div>
                  ))}
                </div>
                <label
                  className="mt-[18px] flex cursor-pointer items-center gap-3 rounded-[12px] px-4 py-3.5 transition-all"
                  style={{
                    border: "1.5px solid " + (d.disclaimerChecked ? "var(--emerald)" : "var(--line)"),
                    background: d.disclaimerChecked ? "var(--emerald-wash)" : "var(--surface)",
                  }}
                >
                  <span
                    className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px]"
                    style={{
                      border: "1.5px solid " + (d.disclaimerChecked ? "var(--emerald)" : "var(--ink-faint)"),
                      background: d.disclaimerChecked ? "var(--emerald)" : "#fff",
                    }}
                  >
                    {d.disclaimerChecked && <Check className="h-3.5 w-3.5 text-white" />}
                  </span>
                  <input type="checkbox" checked={d.disclaimerChecked} onChange={(e) => set("disclaimerChecked", e.target.checked)} className="hidden" />
                  <span className="text-sm font-semibold leading-tight" style={{ color: "var(--ink)" }}>
                    I confirm all of the above and agree to TrueDrafts&apos; Terms of Service.
                  </span>
                </label>
              </div>

              {error && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--red-wash)", color: "var(--td-red)" }}>{error}</div>
              )}

              <NavRow onBack={goBack} nextDisabled={!step5Valid} isSubmit />

              <p className="text-center text-xs" style={{ color: "var(--ink-faint)" }}>
                Review takes 24–48 hours. You&apos;ll be notified by email once your essays go live.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
