"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle, Trash2, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { User } from "@/lib/db/schema";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  writer: "bg-blue-100 text-[#063d85]",
  reader: "bg-gray-100 text-gray-700",
};

export function AdminUserRow({ user }: { user: User }) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function changeRole(newRole: "reader" | "writer" | "admin") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) setRole(newRole);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to delete account.");
        setDeleting(false);
      }
    } catch {
      setError("Failed to delete account.");
      setDeleting(false);
    }
  }

  return (
    <>
      <tr className="hover:bg-gray-50 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-[#e8f1fa] flex items-center justify-center text-xs font-bold text-[#0851A0] shrink-0">
              {user.name?.[0] ?? "?"}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-gray-900">{user.name}</span>
                {user.verifiedAdmit && <CheckCircle className="h-3.5 w-3.5 text-[#0851A0]" />}
              </div>
              <span className="text-xs text-gray-400">{user.email}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[role]}`}>
            {role}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(user.createdAt)}</td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {(["reader", "writer", "admin"] as const).filter((r) => r !== role).map((r) => (
              <Button
                key={r}
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs capitalize"
                disabled={loading}
                onClick={() => changeRole(r)}
              >
                → {r}
              </Button>
            ))}
            <button
              onClick={() => { setError(""); setConfirming(true); }}
              title="Delete account"
              aria-label="Delete account"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {confirming && (
        <tr>
          <td colSpan={4} className="p-0">
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <Trash2 className="h-[18px] w-[18px]" />
                </div>
                <h2 className="mt-3.5 text-lg font-bold text-gray-900">Delete this account?</h2>
                <p className="mt-1 text-sm font-medium text-gray-700">{user.name} · {user.email}</p>

                <div className="mt-3 space-y-2 text-sm text-gray-600">
                  <p>This account will be removed: the person can no longer log in, and their name and details are scrubbed from the platform.</p>
                  <p>Any essays they published are removed from Browse and search. Anyone who already purchased them keeps access — but the writer will show as an anonymous &ldquo;Deleted user.&rdquo;</p>
                  <p className="text-xs text-gray-400">Purchase, sales and payout records are preserved for accounting. This can&apos;t be undone.</p>
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-5 flex justify-end gap-2.5">
                  <Button variant="outline" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700 gap-2"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete account"}
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
