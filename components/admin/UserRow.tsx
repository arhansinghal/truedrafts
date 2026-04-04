"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { User } from "@/lib/db/schema";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  writer: "bg-blue-100 text-[#063d85]",
  reader: "bg-gray-100 text-gray-700",
};

export function AdminUserRow({ user }: { user: User }) {
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);

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

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[#e8f1fa] flex items-center justify-center text-xs font-bold text-[#0851A0] shrink-0">
            {user.name[0]}
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
        </div>
      </td>
    </tr>
  );
}
