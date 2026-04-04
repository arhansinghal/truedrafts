"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Eye, Clock, ExternalLink } from "lucide-react";
import { essayTypeLabel, formatCents, timeAgo } from "@/lib/utils";
import type { Essay, University, User } from "@/lib/db/schema";

type EssayWithRelations = Essay & {
  university: University;
  writer: Pick<User, "id" | "name" | "email">;
};

export function AdminEssayQueue({ essays }: { essays: EssayWithRelations[] }) {
  const [localEssays, setLocalEssays] = useState(essays);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function approve(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/essays/${id}/approve`, { method: "POST" });
      if (res.ok) {
        setLocalEssays((prev) => prev.map((e) => e.id === id ? { ...e, status: "approved" } : e));
      }
    } finally {
      setLoading(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/essays/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setLocalEssays((prev) => prev.map((e) => e.id === id ? { ...e, status: "rejected", rejectionNote: rejectReason } : e));
        setRejecting(null);
        setRejectReason("");
      }
    } finally {
      setLoading(null);
    }
  }

  if (localEssays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400">No essays in this queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {localEssays.map((essay) => (
        <div key={essay.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* University logo */}
            {essay.university.logoUrl ? (
              <Image src={essay.university.logoUrl} alt={essay.university.name} width={36} height={36} className="rounded-sm object-contain shrink-0 mt-1" />
            ) : (
              <div className="h-9 w-9 rounded-sm bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0 mt-1">
                {essay.university.name[0]}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-gray-900">{essay.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  essay.status === "approved" ? "bg-green-50 text-green-700" :
                  essay.status === "rejected" ? "bg-red-50 text-red-700" :
                  "bg-yellow-50 text-yellow-700"
                }`}>
                  {essay.status}
                </span>
              </div>

              <p className="text-sm text-gray-500">
                {essay.university.name} · {essayTypeLabel(essay.essayType)} · {essay.wordCount} words · {formatCents(essay.priceCents)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                by {essay.writer.name} ({essay.writer.email}) · submitted {timeAgo(essay.createdAt)}
              </p>

              {/* Preview */}
              <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-3 font-serif">
                {essay.previewContent}
              </p>

              {essay.tags && essay.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {essay.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{tag}</span>
                  ))}
                </div>
              )}

              {essay.status === "rejected" && essay.rejectionNote && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                  Rejection reason: {essay.rejectionNote}
                </p>
              )}

              {/* Reject reason input */}
              {rejecting === essay.id && (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                    disabled={!rejectReason.trim() || loading === essay.id}
                    onClick={() => reject(essay.id)}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setRejecting(null); setRejectReason(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Actions */}
            {essay.status === "pending" && (
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  className="gap-1 bg-green-600 hover:bg-green-700"
                  disabled={loading === essay.id}
                  onClick={() => approve(essay.id)}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {loading === essay.id ? "..." : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
                  disabled={loading === essay.id}
                  onClick={() => { setRejecting(essay.id); setRejectReason(""); }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
