"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search, Loader2 } from "lucide-react";

type UniOpt = { id: string; name: string; slug: string };

export function CreateAppForm({ universities }: { universities: UniOpt[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<UniOpt | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universities.slice(0, 8);
    return universities
      .filter((u) => u.name.toLowerCase().includes(q) || u.slug.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, universities]);

  async function handleCreate() {
    if (!selected) {
      setError("Pick a university first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityId: selected.id,
          title: title.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to create");
      }
      const app = await res.json();
      router.push(`/studio/${app.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">School</label>
        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="text-sm font-medium text-gray-900 truncate">{selected.name}</span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] text-gray-500 hover:text-gray-900"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                placeholder="Search Stanford, MIT…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-8 pl-7 pr-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
              />
            </div>
            <div className="mt-1.5 max-h-48 overflow-y-auto rounded-md border border-gray-100">
              {matches.length === 0 ? (
                <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
              ) : (
                matches.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelected(u);
                      setError(null);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    {u.name}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div>
        <label className="text-[11px] font-medium text-gray-500 mb-1.5 block">
          Title <span className="text-gray-400">(optional)</span>
        </label>
        <input
          placeholder={selected ? `${selected.name} Application` : "My application"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full h-8 px-2 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-gray-400"
        />
      </div>

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleCreate}
        disabled={busy || !selected}
        className="w-full h-9 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
      >
        {busy ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
          </>
        ) : (
          "Create workspace"
        )}
      </button>
    </div>
  );
}
