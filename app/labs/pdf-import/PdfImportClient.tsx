"use client";

// Sandbox PDF-import lab client. Upload 1–2 PDFs → AI extraction → editable
// submission preview mirroring the real wizard's fields → sandbox submit.
// All edits live in local state; the only network calls are the two dev-only
// /api/labs endpoints.

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  COMMON_APP_PROMPTS,
  COMMON_APP_WORD_LIMIT,
  type ExtractionResult,
  type SandboxSubmission,
} from "@/lib/labs/pdf-import/schema";

type Uni = { id: string; name: string; aliases: string[] | null };

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Pre-select the dropdown to the AI's best university-name match.
function matchUniversity(name: string, unis: Uni[]): string {
  const q = name.trim().toLowerCase();
  if (!q) return "";
  for (const u of unis) {
    const n = u.name.toLowerCase();
    if (n === q || n.includes(q) || q.includes(n)) return u.id;
  }
  for (const u of unis) {
    if ((u.aliases ?? []).some((a) => a.toLowerCase() === q || q.includes(a.toLowerCase()))) {
      return u.id;
    }
  }
  return "";
}

const selectCls =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs uppercase tracking-widest text-neutral-500">{title}</h2>
      <div className="mt-3 space-y-4 rounded-lg border border-neutral-200 p-5">{children}</div>
    </section>
  );
}

export function PdfImportClient({ universities }: { universities: Uni[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "extracting" | "review" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Editable preview state (seeded from extraction).
  const [data, setData] = useState<ExtractionResult | null>(null);
  const [universityId, setUniversityId] = useState("");
  const [result, setResult] = useState<{ savedTo: string; submission: SandboxSubmission } | null>(null);

  const set = <K extends keyof ExtractionResult>(key: K, value: ExtractionResult[K]) =>
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));

  async function handleExtract() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) return setError("Choose at least one PDF first.");
    if (files.length > 2) return setError("At most 2 PDFs.");
    setError(null);
    setPhase("extracting");
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/labs/pdf-extract", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Extraction failed (${res.status})`);
      const extracted = json as ExtractionResult;
      setData(extracted);
      setUniversityId(matchUniversity(extracted.universityName, universities));
      setFileNames(files.map((f) => f.name));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed.");
      setPhase("idle");
    }
  }

  async function handleSubmit() {
    if (!data) return;
    setError(null);
    setPhase("submitting");
    try {
      const uni = universities.find((u) => u.id === universityId);
      const payload: SandboxSubmission = {
        universityId,
        universityName: uni?.name ?? data.universityName,
        admittedYear: parseInt(data.admittedYear) || CURRENT_YEAR,
        admissionProofUrl: fileNames[0] ? `sandbox://${fileNames[0]}` : "",
        submittedCommonApp: data.submittedCommonApp,
        commonAppPrompt: data.caPromptIndex >= 0 ? COMMON_APP_PROMPTS[data.caPromptIndex] : null,
        commonAppContent: data.caContent || null,
        commonAppScreenshotUrl: null,
        supplementals: data.supplementals,
        numSupplementals: data.supplementals.length,
        extras: {
          activities: data.activities,
          honorsAwards: data.honorsAwards,
          intendedMajor: data.intendedMajor,
          testScores: data.testScores,
          notes: data.notes,
        },
      };
      const res = await fetch("/api/labs/pdf-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Submit failed (${res.status})`);
      setResult({ savedTo: json.savedTo, submission: json.submission });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
      setPhase("review");
    }
  }

  // ─── Done ───────────────────────────────────────────────────────────────────

  if (phase === "done" && result) {
    return (
      <div className="mt-8">
        <div className="rounded-lg border border-green-300 bg-green-50 p-5">
          <p className="font-medium text-green-800">Sandbox submission saved ✓</p>
          <p className="mt-1 text-sm text-green-700">
            Written to <code className="font-mono">{result.savedTo}</code> — no database rows were
            created.
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(result.submission, null, 2))}
          >
            Copy JSON
          </Button>
          <Button variant="outline" onClick={() => { setPhase("review"); setResult(null); }}>
            Back to preview
          </Button>
        </div>
        <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs">
          {JSON.stringify(result.submission, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div>
      {/* ── Upload ── */}
      <Section title="1 · Upload PDFs">
        <p className="text-sm text-neutral-500">
          Your Common App submission PDF, plus optionally a second PDF with university-specific
          supplementals.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          multiple
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
        />
        <Button onClick={handleExtract} disabled={phase === "extracting"}>
          {phase === "extracting" ? "Extracting… (can take ~30s)" : "Extract application data"}
        </Button>
      </Section>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && phase !== "idle" && phase !== "extracting" && (
        <>
          {/* ── Setup ── */}
          <Section title="2 · Application setup">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="uni">University</Label>
                <select
                  id="uni"
                  className={selectCls + " mt-1"}
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {data.universityName && !universityId && (
                  <p className="mt-1 text-xs text-amber-600">
                    Extracted “{data.universityName}” — no match in the universities list, pick manually.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="year">Year admitted</Label>
                <select
                  id="year"
                  className={selectCls + " mt-1"}
                  value={data.admittedYear || String(CURRENT_YEAR)}
                  onChange={(e) => set("admittedYear", e.target.value)}
                >
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={data.submittedCommonApp}
                onChange={(e) => set("submittedCommonApp", e.target.checked)}
              />
              Submitted via Common App
            </label>
            <p className="text-xs text-neutral-400">
              Admission proof (sandbox): <code className="font-mono">{fileNames[0] ?? "—"}</code> stands
              in for the proof upload of the real wizard.
            </p>
          </Section>

          {/* ── Common App essay ── */}
          {data.submittedCommonApp && (
            <Section title="3 · Common App essay">
              <div>
                <Label htmlFor="ca-prompt">Prompt</Label>
                <select
                  id="ca-prompt"
                  className={selectCls + " mt-1"}
                  value={data.caPromptIndex}
                  onChange={(e) => set("caPromptIndex", parseInt(e.target.value))}
                >
                  <option value={-1}>— not detected —</option>
                  {COMMON_APP_PROMPTS.map((p, i) => (
                    <option key={i} value={i}>{`${i + 1}. ${p.slice(0, 90)}…`}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="ca-content">Essay (verbatim)</Label>
                <Textarea
                  id="ca-content"
                  className="mt-1 min-h-64 font-serif"
                  value={data.caContent}
                  onChange={(e) => set("caContent", e.target.value)}
                />
                <p
                  className={`mt-1 text-xs ${
                    countWords(data.caContent) > COMMON_APP_WORD_LIMIT
                      ? "text-amber-600"
                      : "text-neutral-400"
                  }`}
                >
                  {countWords(data.caContent)} / {COMMON_APP_WORD_LIMIT} words
                  {countWords(data.caContent) > COMMON_APP_WORD_LIMIT &&
                    " — over the Common App limit (warning only, still submittable)"}
                </p>
              </div>
            </Section>
          )}

          {/* ── Supplementals ── */}
          <Section title={`4 · Supplemental essays (${data.supplementals.length})`}>
            {data.supplementals.map((s, i) => (
              <div key={i} className="rounded-md border border-neutral-200 p-4">
                <div className="flex items-center justify-between">
                  <Label>Supplemental {i + 1}</Label>
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() =>
                      set("supplementals", data.supplementals.filter((_, j) => j !== i))
                    }
                  >
                    remove
                  </button>
                </div>
                <Input
                  className="mt-2"
                  placeholder="Prompt"
                  value={s.prompt}
                  onChange={(e) =>
                    set("supplementals", data.supplementals.map((x, j) =>
                      j === i ? { ...x, prompt: e.target.value } : x,
                    ))
                  }
                />
                <Textarea
                  className="mt-2 min-h-32 font-serif"
                  placeholder="Essay text"
                  value={s.content}
                  onChange={(e) =>
                    set("supplementals", data.supplementals.map((x, j) =>
                      j === i ? { ...x, content: e.target.value } : x,
                    ))
                  }
                />
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("supplementals", [...data.supplementals, { prompt: "", content: "" }])}
            >
              + Add supplemental
            </Button>
          </Section>

          {/* ── Extras ── */}
          <Section title={`5 · Extracted extras (not in the current schema)`}>
            <div>
              <Label>Activities ({data.activities.length})</Label>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left font-mono uppercase tracking-wide text-neutral-400">
                      <th className="p-1">Position</th>
                      <th className="p-1">Organization</th>
                      <th className="p-1 w-2/5">Description</th>
                      <th className="p-1">Grades</th>
                      <th className="p-1">Hrs/wk</th>
                      <th className="p-1">Wks/yr</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map((a, i) => (
                      <tr key={i} className="border-t border-neutral-100 align-top">
                        {(["position", "organization", "description", "gradeLevels", "hoursPerWeek", "weeksPerYear"] as const).map((field) => (
                          <td key={field} className="p-1">
                            <textarea
                              className="w-full resize-y rounded border border-neutral-200 p-1"
                              rows={field === "description" ? 3 : 1}
                              value={a[field]}
                              onChange={(e) =>
                                set("activities", data.activities.map((x, j) =>
                                  j === i ? { ...x, [field]: e.target.value } : x,
                                ))
                              }
                            />
                          </td>
                        ))}
                        <td className="p-1">
                          <button
                            className="text-red-500 hover:underline"
                            onClick={() => set("activities", data.activities.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() =>
                  set("activities", [
                    ...data.activities,
                    { position: "", organization: "", description: "", gradeLevels: "", hoursPerWeek: "", weeksPerYear: "" },
                  ])
                }
              >
                + Add activity
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="major">Intended major</Label>
                <Input id="major" className="mt-1" value={data.intendedMajor}
                  onChange={(e) => set("intendedMajor", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="scores">Test scores</Label>
                <Input id="scores" className="mt-1" value={data.testScores}
                  onChange={(e) => set("testScores", e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="honors">Honors & awards (one per line)</Label>
              <Textarea
                id="honors"
                className="mt-1"
                value={data.honorsAwards.join("\n")}
                onChange={(e) => set("honorsAwards", e.target.value.split("\n"))}
              />
            </div>
            {data.notes && (
              <p className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-500">
                <span className="font-mono uppercase">AI notes:</span> {data.notes}
              </p>
            )}
          </Section>

          {/* ── Submit ── */}
          <div className="mt-8 flex items-center gap-3">
            <Button onClick={handleSubmit} disabled={phase === "submitting" || !universityId}>
              {phase === "submitting" ? "Submitting…" : "Submit (sandbox)"}
            </Button>
            {!universityId && (
              <p className="text-xs text-neutral-400">Select a university to enable submit.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
