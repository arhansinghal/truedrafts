"use client";
import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReaderSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [name, setName] = useState(session?.user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setMsg(res.ok ? "Saved!" : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={session?.user.email ?? ""} disabled className="mt-1 opacity-60" />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
          </div>
          {msg && <p className="text-sm text-green-600">{msg}</p>}
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
        </form>
      </div>

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
