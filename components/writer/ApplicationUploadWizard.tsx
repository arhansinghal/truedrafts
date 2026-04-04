"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown, Upload, X, ImageIcon, Save } from "lucide-react";
import type { University } from "@/lib/db/schema";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMON_APP_PROMPTS = [
  "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it. If this sounds like you, then please share your story.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure. How did it affect you, and what did you learn from the experience?",
  "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way. How has this gratitude affected or motivated you?",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you? What or who do you turn to when you want to learn more?",
  "Share an essay on any topic of your choice. It can be one you've already written, one that responds to a different prompt, or one of your own design.",
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);
const COMMON_APP_WORD_LIMIT = 700;

const STEP_LABELS = ["Application Setup", "Common App Essay", "Supplemental Essays", "Review & Submit"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplementalEntry {
  prompt: string;
  content: string;
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
  // Step 3
  supplementals: SupplementalEntry[];
  // Step 4
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
  supplementals: [{ prompt: "", content: "" }],
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

  // Step validity
  const step1Valid = !!d.universityId && !!d.admissionProof;
  const step2Valid = !d.submittedCommonApp || (d.caPromptIndex >= 0 && d.caContent.trim().length > 0 && !!d.caScreenshot);
  const step3Valid = d.supplementals.every((s) => s.content.trim().length > 0);
  const step4Valid = d.disclaimerChecked;

  async function saveAndContinue(nextStep?: number) {
    await saveDraft(step, d);
    if (nextStep !== undefined) setStep(nextStep);
  }

  function goNext() {
    const next = step === 1 ? (d.submittedCommonApp ? 2 : 3) : step === 2 ? 3 : step === 3 ? 4 : 4;
    saveAndContinue(next);
  }

  function goBack() {
    const prev = step === 4 ? 3 : step === 3 ? (d.submittedCommonApp ? 2 : 1) : step === 2 ? 1 : 1;
    setStep(prev);
  }

  // ── Submit application as one unit ─────────────────────────────────────────
  async function handleSubmit() {
    setError("");
    if (!step4Valid) return;
    setLoading(true);
    try {
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
      <StepIndicator current={step} totalSteps={4} />

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
                <Image src={`/uni_logos/${selectedUni.slug}.png`} alt={selectedUni.name} width={32} height={32} className="object-contain p-0.5" unoptimized />
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

          <ImageUpload label={<>Common App Submission Screenshot <span className="text-red-500">*</span></>}
            hint="Upload a screenshot of your Common App PDF showing the submitted essay."
            value={d.caScreenshot} onChange={(v) => set("caScreenshot", v)} />

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
                <Label className="mb-1.5 block">Essay prompt <span className="text-gray-400 font-normal">(optional)</span></Label>
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

      {/* ── Step 4: Review & Submit ── */}
      {step === 4 && (
        <StepCard title="Review & Submit" subtitle="Confirm your application details and agree to our terms.">
          {/* Summary */}
          <div className="rounded-xl border border-[#0851A0]/10 bg-[#f0f5ff] p-5 space-y-2.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0851A0]/60 mb-1">Application Summary</p>
            <div className="grid grid-cols-2 gap-y-1.5">
              <span className="text-gray-500">University</span>
              <span className="font-medium text-gray-800">{selectedUni?.name ?? "—"}</span>
              <span className="text-gray-500">Year admitted</span>
              <span className="font-medium text-gray-800">{d.admittedYear}</span>
              <span className="text-gray-500">Common App</span>
              <span className="font-medium text-gray-800">{d.submittedCommonApp ? "Yes" : "No"}</span>
              <span className="text-gray-500">Supplementals</span>
              <span className="font-medium text-gray-800">{d.numSupplementals}</span>
              <span className="text-gray-500">Total essays</span>
              <span className="font-medium text-[#0851A0] font-semibold">
                {(d.submittedCommonApp ? 1 : 0) + d.numSupplementals} essays
              </span>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-[#0851A0]/15 bg-[#e8f1fa] p-5 space-y-3">
            <p className="text-sm font-semibold text-[#0851A0]">Before you submit, please confirm:</p>
            <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
              <li>The essays I&apos;m submitting are my own original work written for my college application.</li>
              <li>I confirm I was genuinely admitted to the university listed above.</li>
              <li>I understand TrueDrafts will review my submission before it goes live (24–48 hours).</li>
              <li>I agree not to submit essays written by someone else or AI-generated content.</li>
              <li>I understand that misrepresentation may result in permanent removal from the platform.</li>
            </ul>
            <label className="flex items-start gap-3 cursor-pointer mt-3 pt-3 border-t border-[#0851A0]/10">
              <div className="relative mt-0.5 shrink-0">
                <input type="checkbox" checked={d.disclaimerChecked} onChange={(e) => set("disclaimerChecked", e.target.checked)} className="sr-only" />
                <div className={["w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                  d.disclaimerChecked ? "bg-[#0851A0] border-[#0851A0]" : "bg-white border-[#0851A0]/30",
                ].join(" ")}>
                  {d.disclaimerChecked && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
              <span className="text-sm text-gray-700 font-medium leading-snug">
                I confirm all of the above and agree to TrueDrafts&apos; Terms of Service.
              </span>
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <NavRow onBack={goBack} nextDisabled={!step4Valid} isSubmit />

          <p className="text-xs text-gray-400 text-center">
            Review takes 24–48 hours. You&apos;ll be notified by email once your essays go live.
          </p>
        </StepCard>
      )}
    </div>
  );
}
