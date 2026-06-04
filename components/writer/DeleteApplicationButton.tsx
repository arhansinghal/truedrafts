"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, Loader2 } from "lucide-react";

export function DeleteApplicationButton({
  applicationId,
  title,
  isLive,
  hasBuyers,
}: {
  applicationId: string;
  title: string;
  isLive: boolean;
  hasBuyers: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/writer/applications/${applicationId}`, { method: "DELETE" });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Delete application"
        aria-label="Delete application"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] transition-colors"
        style={{ color: "var(--ink-faint)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--td-red)";
          e.currentTarget.style.background = "var(--red-wash)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--ink-faint)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(20,22,30,.45)", backdropFilter: "blur(2px)" }}
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="relative w-full max-w-[440px] rounded-[14px] p-6"
            style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-lg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => !deleting && setOpen(false)}
              className="absolute right-4 top-4"
              style={{ color: "var(--ink-faint)" }}
              aria-label="Close"
            >
              <X className="h-[18px] w-[18px]" />
            </button>

            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: "var(--red-wash)", color: "var(--td-red)" }}
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </div>

            <h2 className="mt-3.5 text-[17px] font-bold" style={{ color: "var(--ink)" }}>
              Delete this application?
            </h2>
            <p className="mt-1 text-[13.5px] font-semibold" style={{ color: "var(--ink-soft)" }}>
              {title}
            </p>

            <div className="mt-3 space-y-2 text-[13.5px]" style={{ color: "var(--ink-soft)", lineHeight: 1.55 }}>
              {isLive ? (
                <>
                  <p>
                    It will no longer be listed in Browse or search, and can&apos;t be purchased again.
                  </p>
                  <p>
                    {hasBuyers ? "Everyone who already purchased it" : "Anyone who has already purchased it"} keeps
                    full access — their library is unaffected.
                  </p>
                </>
              ) : (
                <p>
                  It will be removed from your dashboard and the review queue. Anyone who has already purchased it
                  keeps full access.
                </p>
              )}
              <p className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
                This can&apos;t be undone.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
                className="rounded-[10px] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "var(--td-red)" }}
              >
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : "Delete application"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
