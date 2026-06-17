"use client";
import { useEffect } from "react";

/**
 * Global guard that suppresses casual copying of essay text. It pairs with the
 * `.essay-protected` CSS class (globals.css), which already makes those regions
 * unselectable + kills the iOS long-press callout; this additionally cancels
 * copy / cut / right-click / drag so Ctrl+C, context-menu "Copy" and drag-out
 * are all blocked on essay content — at every stage (preview, purchased reader,
 * admin moderation).
 *
 * Honest limitation: this is *casual*-copy protection only. Any text the browser
 * renders is still in the DOM and can be read via devtools / "View source" /
 * disabling JavaScript — that cannot be prevented client-side.
 */
export function CopyGuard() {
  useEffect(() => {
    const inProtected = (n: EventTarget | null): boolean => {
      const el = n instanceof Element ? n : n instanceof Node ? n.parentElement : null;
      return !!el?.closest(".essay-protected");
    };
    const selectionInProtected = (): boolean => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      for (let i = 0; i < sel.rangeCount; i++) {
        const c = sel.getRangeAt(i).commonAncestorContainer;
        const el = c instanceof Element ? c : c.parentElement;
        if (el?.closest(".essay-protected")) return true;
      }
      return false;
    };

    const onCopyCut = (e: ClipboardEvent) => {
      if (inProtected(e.target) || selectionInProtected()) {
        e.preventDefault();
        e.clipboardData?.setData("text/plain", "");
      }
    };
    const onBlock = (e: Event) => {
      if (inProtected(e.target)) e.preventDefault();
    };

    // Capture phase so we win even if a child stops propagation.
    document.addEventListener("copy", onCopyCut as EventListener, true);
    document.addEventListener("cut", onCopyCut as EventListener, true);
    document.addEventListener("contextmenu", onBlock, true);
    document.addEventListener("dragstart", onBlock, true);
    return () => {
      document.removeEventListener("copy", onCopyCut as EventListener, true);
      document.removeEventListener("cut", onCopyCut as EventListener, true);
      document.removeEventListener("contextmenu", onBlock, true);
      document.removeEventListener("dragstart", onBlock, true);
    };
  }, []);

  return null;
}
