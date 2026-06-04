"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import {
  extractSentences,
  diffNewSentences,
} from "@/lib/studio/sentence-detect";

type SaveState = "idle" | "saving" | "saved" | "error";

export type StudioEditorHandle = {
  insertText: (text: string) => void;
  getEssayContext: () => string;
};

export const StudioEditor = forwardRef<
  StudioEditorHandle,
  {
    essayId: string;
    initialTitle: string;
    initialPrompt: string | null;
    initialWordCap: number | null;
    initialContent: string;
    onSentenceEnd: (sentence: string) => void;
  }
>(function StudioEditor(
  {
    essayId,
    initialTitle,
    initialPrompt,
    initialWordCap,
    initialContent,
    onSentenceEnd,
  },
  ref,
) {
  console.log("[studio] StudioEditor render v=4", { essayId });

  const [title, setTitle] = useState(initialTitle);
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [wordCap, setWordCap] = useState<string>(initialWordCap ? String(initialWordCap) : "");
  const [wordCount, setWordCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const lastSentencesRef = useRef<string[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing your essay...",
      }),
    ],
    content: safeParse(initialContent),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[60vh] px-2 py-4 text-gray-900",
      },
    },
  });

  // Bind the update listener via editor.on — the inline `onUpdate` option in
  // useEditor doesn't reliably fire in this Tiptap v3 + Turbopack setup.
  const onSentenceEndRef = useRef(onSentenceEnd);
  useEffect(() => {
    onSentenceEndRef.current = onSentenceEnd;
  }, [onSentenceEnd]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const text = editor.getText();
      console.log("[studio] update fired, text len=", text.length, "last 20:", text.slice(-20));
      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
      const sentences = extractSentences(text);
      const newOnes = diffNewSentences(lastSentencesRef.current, sentences);
      console.log("[studio]   sentences total=", sentences.length, "new=", newOnes.length);
      lastSentencesRef.current = sentences;
      for (const s of newOnes) {
        console.log("[studio] sentence-end →", s);
        onSentenceEndRef.current(s);
      }
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
    };
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => insertContinuation(editor, text),
      getEssayContext: () => editor?.getText() ?? "",
    }),
    [editor],
  );

  useEffect(() => {
    if (!editor) return;
    const text = editor.getText();
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    lastSentencesRef.current = extractSentences(text);
  }, [editor]);

  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = true;
  }, [title, prompt, wordCap, wordCount]);

  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      console.log("[studio] schedule fired (inside save effect)");
      const text = editor.getText();
      const sentences = extractSentences(text);
      const newOnes = diffNewSentences(lastSentencesRef.current, sentences);
      console.log("[studio]   sentences total=", sentences.length, "new=", newOnes.length);
      lastSentencesRef.current = sentences;
      for (const s of newOnes) {
        console.log("[studio] sentence-end →", s);
        onSentenceEndRef.current(s);
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, 1500);
    };
    const save = async () => {
      if (!dirtyRef.current) return;
      setSaveState("saving");
      try {
        const text = editor.getText();
        const res = await fetch(`/api/studio/essays/${essayId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            prompt: prompt || null,
            wordCap: wordCap ? Number(wordCap) : null,
            content: JSON.stringify(editor.getJSON()),
            contentText: text,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        dirtyRef.current = false;
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch {
        setSaveState("error");
      }
    };
    editor.on("update", schedule);
    return () => {
      editor.off("update", schedule);
      if (timer) clearTimeout(timer);
      if (dirtyRef.current) save();
    };
  }, [editor, essayId, title, prompt, wordCap]);

  const cap = wordCap ? Number(wordCap) : null;
  const overCap = cap !== null && wordCount > cap;
  const pctCap = cap !== null ? Math.min(100, (wordCount / cap) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Essay title"
          className="flex-1 border-0 bg-transparent px-0 text-2xl font-semibold tracking-tight text-gray-900 focus:outline-none placeholder-gray-300"
        />
        <SaveBadge state={saveState} />
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Paste the prompt here so the coach knows what you're answering…"
          className="text-xs min-h-[44px] resize-none rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-gray-600 focus:outline-none focus:border-gray-300"
        />
        <div className="flex flex-col items-end gap-1.5">
          <input
            value={wordCap}
            onChange={(e) => setWordCap(e.target.value.replace(/\D/g, ""))}
            placeholder="cap"
            className="h-7 w-20 rounded-md border border-gray-100 px-2 text-xs focus:outline-none focus:border-gray-300"
          />
          <span className={`text-[10px] ${overCap ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {wordCount}{cap ? ` / ${cap}` : ""} words
          </span>
        </div>
      </div>

      {cap !== null && (
        <div className="mb-6 h-0.5 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full transition-all ${overCap ? "bg-red-500" : "bg-gray-900"}`}
            style={{ width: `${pctCap}%` }}
          />
        </div>
      )}

      <div className="rounded-xl bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

// Inserts a continuation immediately after the cursor (or after the last
// non-empty sentence). Adds a leading space if the text before the cursor
// doesn't already end in whitespace, so we don't glue tokens together.
function insertContinuation(editor: Editor | null, text: string) {
  if (!editor || !text) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  // Move to end so suggestions always append at the writing frontier.
  editor.chain().focus().command(({ tr, state, dispatch }) => {
    const end = state.doc.content.size;
    const selectionEnd = tr.selection.to;
    // If the user clicked into the middle of the doc, use that point; else doc end.
    const insertPoint = selectionEnd > 0 ? selectionEnd : end;
    if (dispatch) {
      const before = state.doc.textBetween(Math.max(0, insertPoint - 1), insertPoint);
      const needSpace = before && !/\s/.test(before);
      const out = (needSpace ? " " : "") + trimmed;
      tr.insertText(out, insertPoint);
      dispatch(tr);
    }
    return true;
  }).run();
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
        <AlertCircle className="h-3 w-3" /> Save failed
      </span>
    );
  }
  return null;
}

function safeParse(s: string): object {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object") return v;
  } catch {}
  return { type: "doc", content: [{ type: "paragraph" }] };
}
