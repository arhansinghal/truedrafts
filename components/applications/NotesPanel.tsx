"use client";

import { useState } from "react";
import { Download, Highlighter, Trash2, X } from "lucide-react";
import {
  HIGHLIGHT_COLORS,
  previewQuote,
  type HighlightColor,
  type StoredHighlight,
} from "@/lib/highlights/anchor";

const SWATCH: Record<HighlightColor, string> = {
  yellow: "#F7CD46",
  blue: "#0851A0",
  green: "#1C7A57",
  pink: "#B23A2E",
};

/** Plain-text export a reader can paste into their own notes. */
function toMarkdown(title: string, items: readonly StoredHighlight[]): string {
  const lines = [`# Notes on ${title}`, ""];
  for (const item of items) {
    lines.push(`> ${item.quote.replace(/\n+/g, " ")}`);
    if (item.note) lines.push("", item.note);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * The reader's own marks on this application: every highlight, its note, and a
 * way to export the lot.
 */
export function NotesPanel({
  title,
  items,
  onUpdate,
  onRemove,
  onClose,
  focusedId,
}: {
  title: string;
  items: readonly StoredHighlight[];
  onUpdate: (
    id: string,
    patch: { note?: string | null; color?: HighlightColor },
  ) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  focusedId: string | null;
}) {
  const [draftId, setDraftId] = useState<string | null>(focusedId);
  const [draft, setDraft] = useState("");

  function startEditing(item: StoredHighlight) {
    setDraftId(item.id);
    setDraft(item.note ?? "");
  }

  function commit(item: StoredHighlight) {
    onUpdate(item.id, { note: draft.trim() ? draft : null });
    setDraftId(null);
  }

  function download() {
    const blob = new Blob([toMarkdown(title, items)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <aside
      className="flex h-full w-full flex-col"
      style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
      aria-label="Your notes"
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3"
        style={{ borderBottom: "1px solid var(--line-soft)" }}
      >
        <span
          className="flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: "var(--ink)" }}
        >
          <Highlighter className="h-[15px] w-[15px]" />
          Your notes
          <span style={{ color: "var(--ink-faint)", fontWeight: 500 }}>
            ({items.length})
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={download}
            disabled={items.length === 0}
            className="rounded-[7px] p-1.5 disabled:opacity-40"
            style={{ color: "var(--ink-faint)" }}
            aria-label="Export notes"
          >
            <Download className="h-[15px] w-[15px]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] p-1.5"
            style={{ color: "var(--ink-faint)" }}
            aria-label="Close notes"
          >
            <X className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {items.length === 0 && (
          <p
            className="mt-6 text-center text-[12.5px]"
            style={{ color: "var(--ink-faint)" }}
          >
            Select any passage to highlight it. Click a highlight to attach a
            note.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-[10px] p-3"
              style={{
                background:
                  item.id === focusedId ? "var(--blue-wash)" : "var(--paper)",
                border: "1px solid var(--line-soft)",
              }}
            >
              <p
                className="serif text-[13px] italic"
                style={{
                  margin: 0,
                  color: "var(--ink-soft)",
                  borderLeft: `2px solid ${SWATCH[item.color]}`,
                  paddingLeft: 9,
                }}
              >
                {previewQuote(item.quote)}
              </p>

              {draftId === item.id ? (
                <div className="mt-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(item)}
                    rows={3}
                    autoFocus
                    placeholder="What stood out?"
                    className="w-full resize-none rounded-[7px] px-2 py-1.5 text-[12.5px] outline-none"
                    style={{
                      border: "1px solid var(--line)",
                      color: "var(--ink)",
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditing(item)}
                  className="mt-2 block w-full text-left text-[12.5px]"
                  style={{
                    color: item.note ? "var(--ink)" : "var(--ink-faint)",
                  }}
                >
                  {item.note ?? "Add a note"}
                </button>
              )}

              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onUpdate(item.id, { color })}
                      aria-label={`Colour this ${color}`}
                      className="h-[13px] w-[13px] rounded-full"
                      style={{
                        background: SWATCH[color],
                        outline:
                          item.color === color
                            ? "2px solid var(--ink-faint)"
                            : "none",
                        outlineOffset: 1,
                      }}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-[6px] p-1"
                  style={{ color: "var(--td-red)" }}
                  aria-label="Remove highlight"
                >
                  <Trash2 className="h-[13px] w-[13px]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
