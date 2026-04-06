"use client";
import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
  Clock,
  FileText,
  Trash2,
  DollarSign,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import type { CollegeApplication, University, User } from "@/lib/db/schema";

type AppWithRelations = CollegeApplication & {
  university: University;
  writer: Pick<User, "id" | "name" | "email">;
};

interface Supplemental {
  prompt?: string;
  content?: string;
}

const CA_PROMPTS = [
  "Some students have a background, identity, interest, or talent that is so meaningful they believe their application would be incomplete without it.",
  "The lessons we take from obstacles we encounter can be fundamental to later success. Recount a time when you faced a challenge, setback, or failure.",
  "Reflect on a time when you questioned or challenged a belief or idea. What prompted your thinking? What was the outcome?",
  "Reflect on something that someone has done for you that has made you happy or thankful in a surprising way.",
  "Discuss an accomplishment, event, or realization that sparked a period of personal growth and a new understanding of yourself or others.",
  "Describe a topic, idea, or concept you find so engaging that it makes you lose all track of time. Why does it captivate you?",
  "Share an essay on any topic of your choice — it can be one you've already written, one that responds to a different prompt, or one of your own design.",
];

const statusConfig: Record<string, { label: string; style: string; icon: React.ElementType }> = {
  pending:  { label: "Pending",  style: "bg-yellow-50 text-yellow-700",  icon: Clock },
  approved: { label: "Approved", style: "bg-green-50 text-green-700",    icon: CheckCircle },
  rejected: { label: "Rejected", style: "bg-red-50 text-red-700",        icon: XCircle },
  archived: { label: "Archived", style: "bg-gray-100 text-gray-500",     icon: FileText },
};

export function AdminApplicationQueue({ applications }: { applications: AppWithRelations[] }) {
  const [local, setLocal] = useState(applications);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<Record<string, string>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<string, string>>({});

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
    setEditing(null);
    setEditData({});
  }

  function startEdit(app: AppWithRelations) {
    let supps: Supplemental[] = [];
    try { supps = JSON.parse(app.supplementals ?? "[]"); } catch { supps = []; }
    setEditData({
      title: app.title,
      admittedYear: app.admittedYear ?? "",
      commonAppPrompt: app.commonAppPrompt ?? "",
      commonAppContent: app.commonAppContent ?? "",
      supplementals: supps,
      tags: (app.tags ?? []).join(", "),
    });
    setEditing(app.id);
  }

  function cancelEdit() { setEditing(null); setEditData({}); }

  async function saveEdit(id: string) {
    setLoading(id);
    setSaveMsg({});
    try {
      const supps = editData.supplementals as Supplemental[];
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editData.title,
          admittedYear: editData.admittedYear ? Number(editData.admittedYear) : null,
          commonAppPrompt: editData.commonAppPrompt,
          commonAppContent: editData.commonAppContent,
          supplementals: supps,
          tags: (editData.tags as string).split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        setLocal((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  title: editData.title as string,
                  admittedYear: editData.admittedYear ? Number(editData.admittedYear) : null,
                  commonAppPrompt: editData.commonAppPrompt as string,
                  commonAppContent: editData.commonAppContent as string,
                  supplementals: JSON.stringify(supps),
                  tags: (editData.tags as string).split(",").map((t) => t.trim()).filter(Boolean),
                }
              : a
          )
        );
        setEditing(null);
        setEditData({});
        setSaveMsg({ [id]: "Saved!" });
        setTimeout(() => setSaveMsg({}), 2000);
      } else {
        setSaveMsg({ [id]: "Save failed." });
      }
    } finally {
      setLoading(null);
    }
  }

  async function approve(id: string) {
    const cents = Math.round(parseFloat(priceInput[id] ?? "0") * 100);
    if (isNaN(cents) || cents < 0) {
      setSaveMsg({ [id]: "Enter a valid price." });
      return;
    }
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: cents }),
      });
      if (res.ok) {
        setLocal((prev) => prev.map((a) => a.id === id ? { ...a, status: "approved", priceCents: cents } : a));
        setApprovingId(null);
        setSaveMsg({ [id]: "Approved and published!" });
        setTimeout(() => setSaveMsg({}), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveMsg({ [id]: data.error ?? "Approval failed." });
      }
    } finally {
      setLoading(null);
    }
  }

  async function reject(id: string) {
    if (!rejectReason.trim()) return;
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (res.ok) {
        setLocal((prev) => prev.map((a) => a.id === id ? { ...a, status: "rejected", rejectionNote: rejectReason } : a));
        setRejecting(null);
        setRejectReason("");
      }
    } finally {
      setLoading(null);
    }
  }

  async function updatePrice(id: string) {
    const cents = Math.round(parseFloat(priceInput[id] ?? "0") * 100);
    if (isNaN(cents) || cents < 0) {
      setSaveMsg({ [id]: "Enter a valid price." });
      return;
    }
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: cents }),
      });
      if (res.ok) {
        setLocal((prev) => prev.map((a) => a.id === id ? { ...a, priceCents: cents } : a));
        setEditingPriceId(null);
        setSaveMsg({ [id]: "Price updated!" });
        setTimeout(() => setSaveMsg({}), 2000);
      } else {
        setSaveMsg({ [id]: "Update failed." });
      }
    } finally {
      setLoading(null);
    }
  }

  async function deleteApp(id: string) {
    setLoading(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLocal((prev) => prev.filter((a) => a.id !== id));
        setDeletingId(null);
      } else {
        setSaveMsg({ [id]: "Delete failed." });
        setDeletingId(null);
      }
    } finally {
      setLoading(null);
    }
  }

  if (local.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400">No applications in this queue.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {local.map((app) => {
        const sc = statusConfig[app.status] ?? statusConfig.pending;
        const StatusIcon = sc.icon;
        const isExpanded = expanded === app.id;
        const isEditing = editing === app.id;
        const isApproving = approvingId === app.id;

        let supps: Supplemental[] = [];
        try { supps = JSON.parse(app.supplementals ?? "[]"); } catch { supps = []; }

        const editSupps = (isEditing ? editData.supplementals : supps) as Supplemental[];

        return (
          <div key={app.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {/* Summary row */}
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleExpand(app.id)}
            >
              {/* Uni logo */}
              <div className="w-10 h-10 rounded-lg border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden bg-white">
                <Image
                  src={`/uni_logos/${app.university.slug}.png`}
                  alt={app.university.name}
                  width={32}
                  height={32}
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 truncate">{app.title}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.style}`}>
                    <StatusIcon className="h-3 w-3" />{sc.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {app.university.name}{app.admittedYear ? ` · Class of ${app.admittedYear}` : ""} · {supps.length + (app.submittedCommonApp ? 1 : 0)} essay{supps.length + (app.submittedCommonApp ? 1 : 0) !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  by {app.writer.name} ({app.writer.email}) · {timeAgo(app.createdAt)}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {saveMsg[app.id] && (
                  <span className="text-xs text-green-600 font-medium">{saveMsg[app.id]}</span>
                )}
                {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
            </div>

            {/* Expanded detail panel */}
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 p-6 space-y-6" onClick={(e) => e.stopPropagation()}>
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-700">Application Details</h4>
                  {!isEditing ? (
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => startEdit(app)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 text-xs bg-[#0851A0] text-white hover:bg-[#063d85]"
                        style={{ background: "#0851A0" }}
                        disabled={loading === app.id}
                        onClick={() => saveEdit(app.id)}
                      >
                        <Save className="h-3.5 w-3.5" />
                        {loading === app.id ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Title + year */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Title</label>
                    {isEditing ? (
                      <input
                        value={editData.title as string}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                      />
                    ) : (
                      <p className="text-sm text-gray-800">{app.title}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Admitted Year</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editData.admittedYear as string}
                        onChange={(e) => setEditData({ ...editData, admittedYear: e.target.value })}
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                      />
                    ) : (
                      <p className="text-sm text-gray-800">{app.admittedYear ?? "—"}</p>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Tags (comma-separated)</label>
                  {isEditing ? (
                    <input
                      value={editData.tags as string}
                      onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(app.tags ?? []).length > 0
                        ? (app.tags ?? []).map((t) => (
                            <span key={t} className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">{t}</span>
                          ))
                        : <span className="text-xs text-gray-400">No tags</span>}
                    </div>
                  )}
                </div>

                {/* Admission proof */}
                {app.admissionProofUrl && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-2">Admission Proof</label>
                    <img
                      src={app.admissionProofUrl}
                      alt="Admission proof"
                      className="max-w-sm max-h-64 rounded-lg border border-gray-200 object-contain bg-white"
                    />
                  </div>
                )}

                {/* Common App essay */}
                {app.submittedCommonApp && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-3">Common App Essay</h5>

                    <div className="mb-3">
                      <label className="text-xs font-medium text-gray-500 block mb-1">Prompt</label>
                      {isEditing ? (
                        <select
                          value={editData.commonAppPrompt as string}
                          onChange={(e) => setEditData({ ...editData, commonAppPrompt: e.target.value })}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                        >
                          <option value="">No prompt selected</option>
                          {CA_PROMPTS.map((p, i) => (
                            <option key={i} value={p}>{`Prompt ${i + 1}: ${p.slice(0, 60)}...`}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-600 italic">{app.commonAppPrompt || "No prompt recorded"}</p>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="text-xs font-medium text-gray-500 block mb-1">Essay Content</label>
                      {isEditing ? (
                        <textarea
                          value={editData.commonAppContent as string}
                          onChange={(e) => setEditData({ ...editData, commonAppContent: e.target.value })}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0] font-serif resize-y"
                          rows={10}
                        />
                      ) : (
                        <p className="text-sm text-gray-800 font-serif leading-relaxed whitespace-pre-wrap">{app.commonAppContent || "—"}</p>
                      )}
                    </div>

                    {app.commonAppScreenshotUrl && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-2">Screenshot</label>
                        <img
                          src={app.commonAppScreenshotUrl}
                          alt="Common App screenshot"
                          className="max-w-sm max-h-64 rounded-lg border border-gray-200 object-contain bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Supplementals */}
                {editSupps.length > 0 && (
                  <div className="space-y-4">
                    <h5 className="text-sm font-semibold text-gray-700">
                      Supplemental Essays ({editSupps.length})
                    </h5>
                    {editSupps.map((s, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Supplemental {i + 1}</p>

                        <div className="mb-3">
                          <label className="text-xs text-gray-400 block mb-1">Prompt (optional)</label>
                          {isEditing ? (
                            <input
                              value={s.prompt ?? ""}
                              onChange={(e) => {
                                const updated = [...editSupps];
                                updated[i] = { ...updated[i], prompt: e.target.value };
                                setEditData({ ...editData, supplementals: updated });
                              }}
                              className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                            />
                          ) : (
                            <p className="text-xs text-gray-600 italic">{s.prompt || "No prompt"}</p>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Essay</label>
                          {isEditing ? (
                            <textarea
                              value={s.content ?? ""}
                              onChange={(e) => {
                                const updated = [...editSupps];
                                updated[i] = { ...updated[i], content: e.target.value };
                                setEditData({ ...editData, supplementals: updated });
                              }}
                              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0] font-serif resize-y"
                              rows={6}
                            />
                          ) : (
                            <p className="text-sm text-gray-800 font-serif leading-relaxed whitespace-pre-wrap">{s.content || "—"}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rejection note */}
                {app.status === "rejected" && app.rejectionNote && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <span className="font-medium">Rejection reason:</span> {app.rejectionNote}
                  </div>
                )}

                {/* Approved: price edit + delete */}
                {app.status === "approved" && (
                  <div className="border-t border-gray-200 pt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {editingPriceId === app.id ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">New price: $</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={(app.priceCents / 100).toFixed(2)}
                              value={priceInput[app.id] ?? ""}
                              onChange={(e) => setPriceInput({ ...priceInput, [app.id]: e.target.value })}
                              className="w-28 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0851A0]"
                              autoFocus
                            />
                          </div>
                          <Button
                            size="sm"
                            className="gap-1 bg-[#0851A0] text-white hover:bg-[#063d85]"
                            style={{ background: "#0851A0" }}
                            disabled={loading === app.id}
                            onClick={() => updatePrice(app.id)}
                          >
                            <Save className="h-3.5 w-3.5" />
                            {loading === app.id ? "Saving..." : "Save Price"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPriceId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => { setEditingPriceId(app.id); setPriceInput({ ...priceInput, [app.id]: (app.priceCents / 100).toFixed(2) }); }}
                        >
                          <DollarSign className="h-3.5 w-3.5" /> Edit Price (${(app.priceCents / 100).toFixed(2)})
                        </Button>
                      )}

                      {deletingId === app.id ? (
                        <>
                          <span className="text-sm text-red-600 font-medium">Delete this application?</span>
                          <Button
                            size="sm"
                            className="gap-1 bg-red-600 hover:bg-red-700 text-white"
                            disabled={loading === app.id}
                            onClick={() => deleteApp(app.id)}
                          >
                            {loading === app.id ? "Deleting..." : "Yes, Delete"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => setDeletingId(app.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      )}
                    </div>
                    {saveMsg[app.id] && (
                      <p className="text-sm text-green-600">{saveMsg[app.id]}</p>
                    )}
                  </div>
                )}

                {/* Action bar */}
                {app.status === "pending" && (
                  <div className="border-t border-gray-200 pt-4 flex flex-col gap-3">
                    {/* Approve flow */}
                    {isApproving ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">Price: $</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={priceInput[app.id] ?? ""}
                            onChange={(e) => setPriceInput({ ...priceInput, [app.id]: e.target.value })}
                            className="w-28 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            autoFocus
                          />
                        </div>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          disabled={loading === app.id}
                          onClick={() => approve(app.id)}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          {loading === app.id ? "Publishing..." : "Confirm & Publish"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setApprovingId(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                          disabled={loading === app.id}
                          onClick={() => { setApprovingId(app.id); setRejecting(null); }}
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={loading === app.id}
                          onClick={() => { setRejecting(app.id); setApprovingId(null); setRejectReason(""); }}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    )}

                    {/* Reject flow */}
                    {rejecting === app.id && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection..."
                          className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                          disabled={!rejectReason.trim() || loading === app.id}
                          onClick={() => reject(app.id)}
                        >
                          Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                      </div>
                    )}

                    {saveMsg[app.id] && (
                      <p className="text-sm text-green-600">{saveMsg[app.id]}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
