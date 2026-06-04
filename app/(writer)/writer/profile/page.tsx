"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  User,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Bell,
  Shield,
  Mail,
  Plus,
  Trash2,
  LogOut,
  Check,
  Lock,
} from "lucide-react";
import { PageHead, StatusPill } from "@/components/writer/Manuscript";

const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","India","China","Germany","France","Japan","South Korea",
  "Singapore","Hong Kong","United Arab Emirates","Saudi Arabia","Brazil","Mexico","Nigeria","Ghana","Kenya","South Africa",
  "Pakistan","Bangladesh","Sri Lanka","Nepal","Malaysia","Indonesia","Philippines","Vietnam","Thailand","Turkey",
  "Egypt","Morocco","Italy","Spain","Netherlands","Sweden","Norway","Denmark","Finland","Switzerland","Austria",
  "Belgium","Poland","Czech Republic","Romania","Hungary","Greece","Portugal","Ireland","New Zealand","Argentina",
  "Chile","Colombia","Peru","Venezuela","Ecuador","Bolivia","Paraguay","Uruguay","Jamaica","Trinidad and Tobago",
  "Barbados","Bahamas","Other",
];

interface Activity {
  name: string;
  description: string;
}
interface ApplicationWithUni {
  id: string;
  title: string;
  admittedYear: number | null;
  status: string;
  university: { name: string; slug: string; logoUrl: string | null };
}

function countWords(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ── small manuscript form helpers ──────────────────────────────────────────────
const FIELD: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-sans)",
  fontSize: 14.5,
  color: "var(--ink)",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "11px 13px",
  outline: "none",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{label}</div>
      {hint && <div className="mb-2 mt-[-2px] text-[12.5px]" style={{ color: "var(--ink-faint)" }}>{hint}</div>}
      {children}
    </label>
  );
}

function Card({ children, pad = 24 }: { children: React.ReactNode; pad?: number }) {
  return (
    <div className="rounded-[14px]" style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-sm)", padding: pad }}>
      {children}
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  sub,
  right,
}: {
  icon: React.ElementType;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: "var(--paper-2)", color: "var(--ink-soft)" }}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>{title}</div>
          {sub && <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--ink-faint)" }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

// Wraps a section's content, blurring + disabling it under a "Coming soon" badge.
function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none" style={{ filter: "blur(3px)", opacity: 0.55 }} aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold"
          style={{ background: "var(--ink)", color: "var(--paper)" }}
        >
          <Lock className="h-3 w-3" /> Coming soon
        </span>
      </div>
    </div>
  );
}

export default function WriterProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [activities, setActivities] = useState<Activity[]>([{ name: "", description: "" }]);
  const [applications, setApplications] = useState<ApplicationWithUni[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/writer/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setName(data.user.name ?? "");
          setBio(data.user.bio ?? "");
          setCountry(data.user.country ?? "");
          try {
            const parsed = JSON.parse(data.user.activities ?? "[]");
            setActivities(Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ name: "", description: "" }]);
          } catch {
            setActivities([{ name: "", description: "" }]);
          }
        }
        if (Array.isArray(data.applications)) setApplications(data.applications);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/writer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, country, activities }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } finally {
      setSaving(false);
    }
  }

  const addActivity = () => activities.length < 10 && setActivities([...activities, { name: "", description: "" }]);
  const removeActivity = (i: number) => setActivities(activities.filter((_, idx) => idx !== i));
  function updateActivity(i: number, field: keyof Activity, value: string) {
    if (field === "description" && countWords(value) > 100) return;
    setActivities(activities.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-[1120px] px-11 pb-[70px] pt-10">
        <PageHead eyebrow="Your account" title="Profile" />
        <div className="flex h-40 items-center justify-center text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="anim-in mx-auto max-w-[1120px] px-11 pb-[70px] pt-10">
      <PageHead
        eyebrow="Your account"
        title="Profile"
        sub="Manage your public writer profile and admits."
        right={
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[10px] px-[18px] py-[11px] text-sm font-semibold text-white"
            style={{ background: saved ? "var(--emerald)" : "var(--td-blue)" }}
          >
            {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save changes"}
          </button>
        }
      />

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Writer profile */}
          <Card>
            <SectionHead icon={User} title="Writer profile" sub="What readers see once they unlock your work." />
            <div className="mt-5 grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <Field label="Full name">
                <input value={name} onChange={(e) => setName(e.target.value)} style={FIELD} />
              </Field>
              <Field label="Country">
                <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ ...FIELD, cursor: "pointer" }}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-3.5">
              <Field label="Email">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-faint)" }}><Mail className="h-4 w-4" /></span>
                  <input value={session?.user.email ?? ""} disabled style={{ ...FIELD, paddingLeft: 36, opacity: 0.6 }} />
                </div>
              </Field>
            </div>
            <div className="mt-3.5">
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={300}
                  style={{ ...FIELD, resize: "vertical", lineHeight: 1.6 }}
                />
                <div className="mt-1 text-right text-[11.5px]" style={{ color: "var(--ink-faint)" }}>{bio.length}/300</div>
              </Field>
            </div>
          </Card>

          {/* Activities */}
          <Card>
            <SectionHead
              icon={Sparkles}
              title="Activities"
              sub="Up to 10 · shown on your profile · 100 words each"
              right={
                <button
                  onClick={addActivity}
                  disabled={activities.length >= 10}
                  className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
                >
                  <Plus className="h-[15px] w-[15px]" /> Add
                </button>
              }
            />
            <div className="mt-[18px] flex flex-col gap-3">
              {activities.map((a, i) => {
                const wc = countWords(a.description);
                return (
                  <div key={i} className="rounded-[12px] p-3.5" style={{ border: "1px solid var(--line)", background: "var(--paper)" }}>
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <span className="mono text-[12px] font-semibold" style={{ color: "var(--td-blue)" }}>{String(i + 1).padStart(2, "0")}</span>
                      <input
                        value={a.name}
                        placeholder="Activity name"
                        onChange={(e) => updateActivity(i, "name", e.target.value)}
                        style={{ ...FIELD, padding: "8px 11px", fontSize: 13.5 }}
                      />
                      {activities.length > 1 && (
                        <button onClick={() => removeActivity(i)} title="Remove" style={{ color: "var(--ink-faint)" }}>
                          <Trash2 className="h-[15px] w-[15px]" />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={a.description}
                      placeholder="Describe this activity (max 100 words)…"
                      onChange={(e) => updateActivity(i, "description", e.target.value)}
                      rows={2}
                      style={{ ...FIELD, fontSize: 13, padding: "9px 11px", resize: "vertical", lineHeight: 1.5 }}
                    />
                    <div className="mt-1 text-right text-[11.5px]" style={{ color: wc >= 95 ? "var(--amber)" : "var(--ink-faint)" }}>{wc}/100 words</div>
                  </div>
                );
              })}
              {activities.length === 0 && (
                <div className="py-5 text-center text-[13px]" style={{ color: "var(--ink-faint)" }}>No activities yet — add up to 10.</div>
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">
          {/* Admits */}
          <Card pad={22}>
            <SectionHead icon={CheckCircle} title="Admits" sub={`${applications.length} ${applications.length === 1 ? "application" : "applications"}`} />
            <div className="mt-4 flex flex-col gap-2.5">
              {applications.length === 0 ? (
                <div className="text-[13px]" style={{ color: "var(--ink-faint)" }}>No submitted applications yet.</div>
              ) : (
                applications.map((app) => (
                  <div key={app.id} className="flex items-center gap-[11px]">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[9px]" style={{ background: "#fff", border: "1px solid var(--line)" }}>
                      <Image src={`/uni_logos/${app.university.slug}.png`} alt={app.university.name} width={28} height={28} className="h-[76%] w-[76%] object-contain" unoptimized />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{app.university.name}</div>
                      {app.admittedYear && <div className="eyebrow mt-0.5">Class of {app.admittedYear}</div>}
                    </div>
                    <StatusPill status={app.status} />
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Referral — coming soon */}
          <Card pad={22}>
            <SectionHead icon={TrendingUp} title="Referral link" sub="Earn a bonus on referred purchases" />
            <div className="mt-4">
              <ComingSoon>
                <div className="flex gap-2">
                  <div className="flex min-w-0 flex-1 items-center rounded-[10px] px-3 py-2.5" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
                    <span className="mono truncate text-[12.5px]" style={{ color: "var(--ink-soft)" }}>truedrafts.com/?ref=••••••</span>
                  </div>
                  <span className="rounded-[10px] px-3 py-2.5 text-[13px] font-semibold" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}>Copy</span>
                </div>
              </ComingSoon>
            </div>
          </Card>

          {/* Notifications — coming soon */}
          <Card pad={22}>
            <SectionHead icon={Bell} title="Notifications" />
            <div className="mt-3">
              <ComingSoon>
                <div className="flex flex-col gap-1">
                  {[["New sale", "Email me when someone unlocks my work"], ["Payouts", "Confirmations and status updates"], ["Tips & product news", "Occasional ways to earn more"]].map(([t, d]) => (
                    <div key={t} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-[13.5px] font-semibold" style={{ color: "var(--ink)" }}>{t}</div>
                        <div className="mt-px text-[12px]" style={{ color: "var(--ink-faint)" }}>{d}</div>
                      </div>
                      <span className="relative h-[23px] w-10 rounded-full" style={{ background: "var(--line)" }}>
                        <span className="absolute left-0.5 top-0.5 h-[19px] w-[19px] rounded-full bg-white" />
                      </span>
                    </div>
                  ))}
                </div>
              </ComingSoon>
            </div>
          </Card>

          {/* Account */}
          <Card pad={22}>
            <SectionHead icon={Shield} title="Account" />
            <div className="mt-4">
              <button
                onClick={() => signOut().then(() => router.push("/"))}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] px-[18px] py-[11px] text-sm font-semibold"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
