"use client";
import { useState, useEffect } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Copy, Check, Plus, Trash2, Clock, CheckCircle, XCircle, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","India","China","Germany","France","Japan","South Korea",
  "Singapore","Hong Kong","United Arab Emirates","Saudi Arabia","Brazil","Mexico","Nigeria","Ghana","Kenya","South Africa",
  "Pakistan","Bangladesh","Sri Lanka","Nepal","Malaysia","Indonesia","Philippines","Vietnam","Thailand","Turkey",
  "Egypt","Morocco","Italy","Spain","Netherlands","Sweden","Norway","Denmark","Finland","Switzerland","Austria",
  "Belgium","Poland","Czech Republic","Romania","Hungary","Greece","Portugal","Ireland","New Zealand","Argentina",
  "Chile","Colombia","Peru","Venezuela","Ecuador","Bolivia","Paraguay","Uruguay","Jamaica","Trinidad and Tobago",
  "Barbados","Bahamas","Other",
];

interface Activity { name: string; description: string; }
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

export default function WriterSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [activities, setActivities] = useState<Activity[]>([{ name: "", description: "" }]);
  const [applications, setApplications] = useState<ApplicationWithUni[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
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

  const referralCode = (session?.user as Record<string, unknown>)?.referralCode as string;
  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : "https://truedrafts.com"}/?ref=${referralCode}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/writer/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, country, activities }),
      });
      setMsg(res.ok ? "Saved!" : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addActivity() {
    if (activities.length < 10) setActivities([...activities, { name: "", description: "" }]);
  }

  function removeActivity(i: number) {
    setActivities(activities.filter((_, idx) => idx !== i));
  }

  function updateActivity(i: number, field: keyof Activity, value: string) {
    if (field === "description") {
      const words = countWords(value);
      if (words > 100) return;
    }
    setActivities(activities.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  }

  const statusConfig: Record<string, { label: string; style: string; icon: React.ElementType }> = {
    pending:  { label: "Pending Approval", style: "bg-[#e8f1fa] text-[#0851A0] border-[#0851A0]/20", icon: Clock },
    approved: { label: "Live",             style: "bg-green-50 text-green-700 border-green-200",      icon: CheckCircle },
    rejected: { label: "Rejected",         style: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
    archived: { label: "Archived",         style: "bg-gray-100 text-gray-500 border-gray-200",        icon: FileText },
  };

  if (!loaded) {
    return (
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Writer Profile */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Writer Profile</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
              rows={3}
              maxLength={300}
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
            >
              <option value="">Select country...</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Email</Label>
            <Input value={session?.user.email ?? ""} disabled className="mt-1 opacity-60" />
          </div>
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <Button type="submit" disabled={saving} className="bg-[#0851A0] text-white hover:bg-[#063d85]" style={{ background: "#0851A0" }}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </div>

      {/* Universities Admitted To */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Universities Admitted To</h2>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-400">No submitted applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => {
              const sc = statusConfig[app.status] ?? statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <div key={app.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden bg-white">
                    <Image
                      src={`/uni_logos/${app.university.slug}.png`}
                      alt={app.university.name}
                      width={28}
                      height={28}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{app.university.name}</p>
                    {app.admittedYear && (
                      <p className="text-xs text-gray-400">Class of {app.admittedYear}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${sc.style}`}>
                    <StatusIcon className="h-3 w-3" />{sc.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activities */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Activities</h2>
            <p className="text-xs text-gray-400 mt-0.5">Up to 10 activities. Each description is capped at 100 words.</p>
          </div>
          {activities.length < 10 && (
            <Button type="button" variant="outline" size="sm" onClick={addActivity} className="gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
        <div className="space-y-4">
          {activities.map((act, i) => {
            const wordCount = countWords(act.description);
            return (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Activity name"
                    value={act.name}
                    onChange={(e) => updateActivity(i, "name", e.target.value)}
                    className="text-sm bg-white"
                  />
                  {activities.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeActivity(i)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div>
                  <textarea
                    placeholder="Describe this activity (max 100 words)..."
                    value={act.description}
                    onChange={(e) => updateActivity(i, "description", e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0] resize-none"
                    rows={3}
                  />
                  <p className={`text-xs mt-1 text-right ${wordCount >= 95 ? "text-orange-500" : "text-gray-400"}`}>
                    {wordCount}/100 words
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-4 bg-[#0851A0] text-white hover:bg-[#063d85]"
          style={{ background: "#0851A0" }}
        >
          {saving ? "Saving..." : "Save activities"}
        </Button>
        {msg && <p className="text-sm text-green-600 mt-2">{msg}</p>}
      </div>

      {/* Referral */}
      {referralCode && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-2">Referral Link</h2>
          <p className="text-xs text-gray-500 mb-3">Share this link to earn a 5% bonus when someone purchases through it.</p>
          <div className="flex items-center gap-2">
            <Input value={referralUrl} readOnly className="text-xs opacity-75" />
            <Button variant="outline" size="sm" onClick={copyReferral} className="shrink-0 gap-1">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      {/* Account */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Account</h2>
        <Button
          variant="outline"
          className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => signOut().then(() => router.push("/"))}
        >
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );
}
