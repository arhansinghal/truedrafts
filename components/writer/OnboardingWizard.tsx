"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ChevronRight, ChevronLeft, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { University } from "@/lib/db/schema";

interface WizardState {
  username: string;
  bio: string;
  selectedUnis: { uniId: string; admittedYear: string }[];
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export function OnboardingWizard({ universities }: { universities: University[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [state, setState] = useState<WizardState>({
    username: "",
    bio: "",
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

  async function saveProfileAndUnis() {
    setSaving(true);
    setError("");
    try {
      // Save profile fields
      const profileRes = await fetch("/api/writer/onboarding/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: state.username, bio: state.bio }),
      });
      if (!profileRes.ok) {
        const d = await profileRes.json();
        throw new Error(d.error ?? "Failed to save profile");
      }

      // Save universities
      if (state.selectedUnis.length > 0) {
        await fetch("/api/writer/onboarding/universities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ universities: state.selectedUnis }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (step === 2) {
      // Before step 3, save data
      try {
        await saveProfileAndUnis();
      } catch {
        return;
      }
    }
    setStep((s) => s + 1);
  }

  async function handleSkipToEssay() {
    if (step === 2) {
      try {
        await saveProfileAndUnis();
      } catch {
        return;
      }
    }
    router.push("/writer/essays/new");
  }

  function handleFinish() {
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

      {/* Step 1: Profile */}
      {step === 1 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Set up your profile</h2>
          <p className="text-gray-500 text-sm mb-6">This is how students will know you</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="username">Username <span className="text-gray-400">(public URL)</span></Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-l-md px-3 py-2">
                  truedrafts.com/writers/
                </span>
                <Input
                  id="username"
                  value={state.username}
                  onChange={(e) =>
                    setState((p) => ({
                      ...p,
                      username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  placeholder="your-name"
                  className="rounded-l-none"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="bio">Bio <span className="text-gray-400">(optional)</span></Label>
              <textarea
                id="bio"
                value={state.bio}
                onChange={(e) => setState((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell students a bit about yourself — where you got in, your major, your story..."
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
                rows={3}
                maxLength={300}
              />
              <p className="text-xs text-gray-400 text-right">{state.bio.length}/300</p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <Button
            className="w-full mt-6 gap-2"
            onClick={() => setStep(2)}
            disabled={!state.username.trim()}
          >
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Universities */}
      {step === 2 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Where did you get in?</h2>
          <p className="text-gray-500 text-sm mb-6">Select the schools you were admitted to</p>

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
                  {uni.logoUrl ? (
                    <Image src={uni.logoUrl} alt={uni.name} width={20} height={20} className="object-contain" />
                  ) : (
                    <div className="h-5 w-5 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      {uni.name[0]}
                    </div>
                  )}
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
            <Button
              className="flex-1 gap-2"
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? "Saving..." : <>Continue <ChevronRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Upload first essay */}
      {step === 3 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Profile saved!</h2>
          <p className="text-gray-500 text-sm mb-8">
            Ready to start earning? Upload your first essay now, or explore your dashboard first.
          </p>

          <div className="space-y-3">
            <Button className="w-full gap-2" onClick={handleSkipToEssay} disabled={saving}>
              Upload My First Essay
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={handleFinish}>
              <SkipForward className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
