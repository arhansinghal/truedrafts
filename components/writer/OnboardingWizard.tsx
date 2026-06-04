"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { University } from "@/lib/db/schema";

interface Activity {
  name: string;
  description: string;
}
interface WizardState {
  name: string;
  country: string;
  bio: string;
  activities: Activity[];
  selectedUnis: { uniId: string; admittedYear: string }[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","India","China","Germany","France","Japan","South Korea",
  "Singapore","Hong Kong","United Arab Emirates","Saudi Arabia","Brazil","Mexico","Nigeria","Ghana","Kenya","South Africa",
  "Pakistan","Bangladesh","Sri Lanka","Nepal","Malaysia","Indonesia","Philippines","Vietnam","Thailand","Turkey",
  "Egypt","Morocco","Italy","Spain","Netherlands","Sweden","Norway","Denmark","Finland","Switzerland","Austria",
  "Belgium","Poland","Czech Republic","Romania","Hungary","Greece","Portugal","Ireland","New Zealand","Argentina",
  "Chile","Colombia","Peru","Venezuela","Ecuador","Bolivia","Paraguay","Uruguay","Jamaica","Trinidad and Tobago",
  "Barbados","Bahamas","Other",
];

export function OnboardingWizard({
  universities,
  initialName = "",
}: {
  universities: University[];
  initialName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [state, setState] = useState<WizardState>({
    name: initialName,
    country: "",
    bio: "",
    activities: [],
    selectedUnis: [],
  });

  const totalSteps = 3;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  function toggleUni(uniId: string) {
    setState((prev) => {
      const existing = prev.selectedUnis.find((u) => u.uniId === uniId);
      if (existing) {
        return { ...prev, selectedUnis: prev.selectedUnis.filter((u) => u.uniId !== uniId) };
      }
      return {
        ...prev,
        selectedUnis: [...prev.selectedUnis, { uniId, admittedYear: String(CURRENT_YEAR) }],
      };
    });
  }

  function setYear(uniId: string, year: string) {
    setState((prev) => ({
      ...prev,
      selectedUnis: prev.selectedUnis.map((u) =>
        u.uniId === uniId ? { ...u, admittedYear: year } : u
      ),
    }));
  }

  function addActivity() {
    setState((p) => (p.activities.length >= 10 ? p : { ...p, activities: [...p.activities, { name: "", description: "" }] }));
  }
  function removeActivity(i: number) {
    setState((p) => ({ ...p, activities: p.activities.filter((_, idx) => idx !== i) }));
  }
  function updateActivity(i: number, field: keyof Activity, value: string) {
    setState((p) => ({
      ...p,
      activities: p.activities.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)),
    }));
  }

  async function saveProfile(fields: Partial<{ name: string; country: string; bio: string; activities: Activity[] }>) {
    const res = await fetch("/api/writer/onboarding/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error ?? "Failed to save");
    }
  }

  async function saveUnis() {
    if (state.selectedUnis.length > 0) {
      await fetch("/api/writer/onboarding/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universities: state.selectedUnis }),
      });
    }
  }

  // Step 1 → Step 2: save name + country.
  async function handleStep1Next() {
    setSaving(true);
    setError("");
    try {
      await saveProfile({ name: state.name, country: state.country });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Step 2 → Step 3: save universities.
  async function handleStep2Next() {
    setSaving(true);
    setError("");
    try {
      await saveUnis();
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Step 3 "Finish": save bio + activities, then go to dashboard.
  async function handleFinish() {
    setSaving(true);
    setError("");
    try {
      await saveProfile({ bio: state.bio, activities: state.activities });
      router.push("/writer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  // Step 3 "Skip, finish later": straight to the dashboard, fill in later from Profile.
  function handleSkip() {
    router.push("/writer");
  }

  return (
    <div className="w-full max-w-xl">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step 1: Name + country */}
      {step === 1 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome — let&apos;s set up your profile</h2>
          <p className="text-gray-500 text-sm mb-6">This is how students will know you.</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={state.name}
                onChange={(e) => setState((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your full name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                value={state.country}
                onChange={(e) => setState((p) => ({ ...p, country: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
              >
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <Button
            className="w-full mt-6 gap-2"
            onClick={handleStep1Next}
            disabled={!state.name.trim() || saving}
          >
            {saving ? "Saving..." : <>Continue <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </div>
      )}

      {/* Step 2: Universities */}
      {step === 2 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Where did you get in?</h2>
          <p className="text-gray-500 text-sm mb-6">Select the schools you were admitted to and the year.</p>

          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {universities.map((uni) => {
              const selected = state.selectedUnis.find((u) => u.uniId === uni.id);
              return (
                <button
                  key={uni.id}
                  onClick={() => toggleUni(uni.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all",
                    selected
                      ? "border-[#0851A0] bg-[#e8f1fa] text-[#0851A0]"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  <span className="truncate">{uni.name}</span>
                  {selected && <CheckCircle className="h-4 w-4 shrink-0 ml-auto" />}
                </button>
              );
            })}
          </div>

          {/* Year selectors */}
          {state.selectedUnis.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Admission year</p>
              {state.selectedUnis.map(({ uniId, admittedYear }) => {
                const uni = universities.find((u) => u.id === uniId);
                return (
                  <div key={uniId} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 flex-1 truncate">{uni?.name}</span>
                    <select
                      value={admittedYear}
                      onChange={(e) => setYear(uniId, e.target.value)}
                      className="text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={String(y)}>{y}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setStep(1)} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button className="flex-1 gap-2" onClick={handleStep2Next} disabled={saving}>
              {saving ? "Saving..." : <>Continue <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Bio + activities */}
      {step === 3 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Tell students about yourself</h2>
          <p className="text-gray-500 text-sm mb-6">Optional — you can always finish this later from your profile.</p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="bio">Bio <span className="text-gray-400">(optional)</span></Label>
              <textarea
                id="bio"
                value={state.bio}
                onChange={(e) => setState((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Where you got in, your major, your story…"
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
                rows={3}
                maxLength={300}
              />
              <p className="text-xs text-gray-400 text-right">{state.bio.length}/300</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label>Activities <span className="text-gray-400">(optional)</span></Label>
                <button
                  type="button"
                  onClick={addActivity}
                  disabled={state.activities.length >= 10}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#0851A0] hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add activity
                </button>
              </div>

              {state.activities.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">
                  Add extracurriculars to show on your profile (up to 10).
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {state.activities.map((a, i) => (
                    <div key={i} className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={a.name}
                          placeholder="Activity name"
                          onChange={(e) => updateActivity(i, "name", e.target.value)}
                          className="h-8 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeActivity(i)}
                          className="text-gray-400 hover:text-red-500 shrink-0"
                          aria-label="Remove activity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        value={a.description}
                        placeholder="Brief description (optional)…"
                        onChange={(e) => updateActivity(i, "description", e.target.value)}
                        className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={handleSkip} disabled={saving} className="gap-1">
              Skip, finish later
            </Button>
            <Button className="flex-1 gap-2" onClick={handleFinish} disabled={saving}>
              {saving ? "Saving..." : <>Finish <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
