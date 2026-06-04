"use client";

// Per-app Research Hub. Drop-in URL or PDF, see status dot, refetch, delete.
// Lives in the workspace right gutter above the suggestions panel.

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Link2,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react";

type Source = {
  id: string;
  appId: string;
  kind: "url" | "pdf";
  uri: string;
  title: string;
  status: "pending" | "ingesting" | "ready" | "failed" | "paywalled";
  errorMessage: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
};

export function HubPanel({ appId }: { appId: string }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch(`/api/studio/sources?appId=${appId}`);
    if (res.ok) setSources(await res.json());
  }

  useEffect(() => {
    load();
  }, [appId]);

  async function addUrl() {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, url: url.trim() }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || "Failed to add URL");
        return;
      }
      setUrl("");
      setAdding(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function addPdf(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("appId", appId);
      fd.set("file", file);
      const res = await fetch("/api/studio/sources", { method: "POST", body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error || "Failed to upload PDF");
        return;
      }
      await load();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function refetch(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/studio/sources/${id}`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this source from the hub?")) return;
    setBusy(true);
    try {
      await fetch(`/api/studio/sources/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-gray-100">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-700">
          Research Hub
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[10px] font-medium text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {adding && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex gap-1.5">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a URL"
              className="flex-1 h-7 rounded-md border border-gray-200 px-2 text-xs focus:outline-none focus:border-gray-400"
              onKeyDown={(e) => e.key === "Enter" && addUrl()}
              autoFocus
            />
            <button
              type="button"
              onClick={addUrl}
              disabled={busy || !url.trim()}
              className="h-7 px-2 rounded-md bg-gray-900 text-white text-xs hover:bg-gray-800 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-200 px-2 py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50"
          >
            <Upload className="h-3 w-3" />
            Upload PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addPdf(f);
            }}
          />
          {error && <p className="text-[10px] text-red-600">{error}</p>}
        </div>
      )}

      <div className="px-2 pb-2 max-h-44 overflow-y-auto">
        {sources.length === 0 ? (
          <p className="px-2 py-2 text-[10px] text-gray-400 leading-relaxed">
            Drop in URLs and PDFs to ground suggestions in your school&apos;s real
            sources — professors, labs, programs, traditions.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {sources.map((s) => (
              <li
                key={s.id}
                className="group flex items-start gap-1.5 px-2 py-1.5 rounded-md hover:bg-gray-50"
              >
                <StatusDot status={s.status} />
                <div className="min-w-0 flex-1">
                  <a
                    href={s.kind === "url" ? s.uri : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[11px] text-gray-700 hover:text-gray-900"
                    title={s.title}
                  >
                    {s.title}
                  </a>
                  <p className="text-[9px] text-gray-400 mt-0.5 inline-flex items-center gap-1">
                    {s.kind === "url" ? (
                      <Link2 className="h-2.5 w-2.5" />
                    ) : (
                      <FileText className="h-2.5 w-2.5" />
                    )}
                    {s.status}
                  </p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                  {s.kind === "url" && (
                    <button
                      type="button"
                      onClick={() => refetch(s.id)}
                      disabled={busy}
                      title="Re-fetch"
                      className="p-1 rounded hover:bg-gray-200 text-gray-500"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={busy}
                    title="Remove"
                    className="p-1 rounded hover:bg-gray-200 text-red-500"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: Source["status"] }) {
  if (status === "ready") {
    return <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-500" />;
  }
  if (status === "failed") {
    return <AlertCircle className="h-3 w-3 mt-0.5 text-red-500" />;
  }
  if (status === "paywalled") {
    return <Lock className="h-3 w-3 mt-0.5 text-amber-500" />;
  }
  return <Loader2 className="h-3 w-3 mt-0.5 text-gray-400 animate-spin" />;
}
