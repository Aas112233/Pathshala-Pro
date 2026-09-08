"use client";
import React, { useRef, useEffect, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  List,
  ListOrdered,
  Eraser,
  Undo2,
  Redo2,
} from "lucide-react";

function sanitizeHtml(html: string): string {
  // Allow only safe inline formatting tags — strip everything else (script, style, etc.)
  // ponytail: naive whitelist sanitizer, upgrade to DOMPurify if you need full HTML email fidelity
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SUB", "SUP", "BR", "P", "UL", "OL", "LI", "SPAN", "DIV"]);
  if (typeof document === "undefined") return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!allowed.has(child.tagName)) {
        // unwrap: move its children up, remove the tag
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        node.removeChild(child);
      } else {
        // strip attributes except we keep nothing (no style/on*)
        for (const attr of Array.from(child.attributes)) child.removeAttribute(attr.name);
        walk(child);
      }
    }
  };
  walk(tmp);
  return tmp.innerHTML;
}

export function RichTextField({
  value,
  onChange,
  placeholder,
  minHeight = "72px",
  className = "",
  onFocus,
  singleLine = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  onFocus?: () => void;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const [active, setActive] = React.useState({ bold: false, italic: false, underline: false, strike: false, sub: false, sup: false });

  // Sync external value -> DOM (when not focused/composing)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const next = value || "";
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  const isCaretInTag = useCallback((tag: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !ref.current) return false;
    let node: Node | null = sel.anchorNode;
    // If caret is in text node, start from its parent
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== ref.current) {
      if ((node as Element).tagName === tag) return true;
      node = (node as Element).parentElement;
    }
    return false;
  }, []);

  const updateActive = useCallback(() => {
    try {
      // For B/I/U queryCommandState is reliable; for SUB/SUP use DOM ancestor so highlight stays while typing inside <sub>/<sup>
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
        sub: isCaretInTag("SUB") || document.queryCommandState("subscript"),
        sup: isCaretInTag("SUP") || document.queryCommandState("superscript"),
      });
    } catch {}
  }, [isCaretInTag]);

  useEffect(() => {
    document.addEventListener("selectionchange", updateActive);
    return () => document.removeEventListener("selectionchange", updateActive);
  }, [updateActive]);

  const exitTag = useCallback((tag: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !ref.current) return;
    let node: Node | null = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== ref.current) {
      if ((node as Element).tagName === tag) {
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        // Insert zero-width space if next sibling is not text, so typing starts outside tag
        const after = (node as Element).nextSibling;
        if (!after || after.nodeType !== 3) {
          const zw = document.createTextNode("\u200B");
          (node as Element).parentNode?.insertBefore(zw, (node as Element).nextSibling);
          range.setStart(zw, 1);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        break;
      }
      node = (node as Element).parentElement;
    }
  }, []);

  const exec = useCallback(
    (command: string, arg?: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      const wasSub = isCaretInTag("SUB") || document.queryCommandState("subscript");
      const wasSup = isCaretInTag("SUP") || document.queryCommandState("superscript");
      const wasCollapsed = sel ? sel.isCollapsed : true;
      // Sub/sup are mutually exclusive — disable the opposite first so toggle actually flips
      if (command === "subscript" && (wasSup || document.queryCommandState("superscript"))) {
        document.execCommand("superscript", false, undefined);
      }
      if (command === "superscript" && (wasSub || document.queryCommandState("subscript"))) {
        document.execCommand("subscript", false, undefined);
      }
      // execCommand is deprecated but still the lightest zero-dep way for B/I/U/lists in every browser
      // ponytail: replace with Selection+Range wrapping if browsers drop execCommand
      document.execCommand(command, false, arg);
      // When disabling via collapsed caret, move caret outside the tag so next chars are normal
      if (wasCollapsed) {
        if (command === "subscript" && wasSub) exitTag("SUB");
        if (command === "superscript" && wasSup) exitTag("SUP");
      }
      // Give browser a tick to settle selection, then refresh highlight
      setTimeout(updateActive, 0);
      const html = sanitizeHtml(el.innerHTML);
      onChange(html);
    },
    [onChange, updateActive, isCaretInTag, exitTag]
  );

  const handleInput = () => {
    if (isComposing.current) return;
    const el = ref.current;
    if (!el) return;
    updateActive();
    onChange(el.innerHTML);
  };

  const isEmpty = !value || value === "<br>" || value.replace(/<[^>]*>/g, "").trim() === "";

  const btnActive = "bg-primary text-primary-foreground hover:bg-primary/90";
  const btnIdle = "hover:bg-muted text-foreground";

  return (
    <div className={`rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-primary overflow-hidden ${className}`}>
      {/* Toolbar — compact, enterprise, icon-only with active toggle */}
      <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 bg-muted/40 border-b border-border">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} className={`p-1 rounded ${active.bold ? btnActive : btnIdle}`} title="Bold (Ctrl+B)" aria-pressed={active.bold}><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} className={`p-1 rounded ${active.italic ? btnActive : btnIdle}`} title="Italic (Ctrl+I)" aria-pressed={active.italic}><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} className={`p-1 rounded ${active.underline ? btnActive : btnIdle}`} title="Underline (Ctrl+U)" aria-pressed={active.underline}><Underline className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("strikeThrough"); }} className={`p-1 rounded ${active.strike ? btnActive : btnIdle}`} title="Strikethrough" aria-pressed={active.strike}><Strikethrough className="h-3.5 w-3.5" /></button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("subscript"); }} className={`p-1 rounded ${active.sub ? btnActive : btnIdle}`} title="Subscript (H₂O) — click again to return to normal" aria-pressed={active.sub}><Subscript className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("superscript"); }} className={`p-1 rounded ${active.sup ? btnActive : btnIdle}`} title="Superscript (x²) — click again to return to normal" aria-pressed={active.sup}><Superscript className="h-3.5 w-3.5" /></button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }} className="p-1 rounded hover:bg-muted text-foreground" title="Bullet list"><List className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }} className="p-1 rounded hover:bg-muted text-foreground" title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); updateActive(); }} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Clear formatting"><Eraser className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("undo"); }} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("redo"); }} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
        onFocus={() => { onFocus?.(); updateActive(); }}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
        onBlur={() => {
          const el = ref.current;
          if (!el) return;
          onChange(sanitizeHtml(el.innerHTML));
        }}
        data-placeholder={placeholder}
        className={`px-3 py-2 text-xs leading-relaxed outline-none overflow-y-auto break-words ${singleLine ? "whitespace-nowrap overflow-hidden" : "whitespace-pre-wrap"}`}
        style={{ minHeight, maxHeight: singleLine ? minHeight : "220px" }}
      />
      <style>{`[contenteditable][data-placeholder]:empty:before{content:attr(data-placeholder);color:hsl(var(--muted-foreground));pointer-events:none;}`}</style>
      {isEmpty && value && value.includes("<") ? null : null}
    </div>
  );
}

export function renderRichText(html: string): { __html: string } | null {
  if (!html) return null;
  // Detect HTML vs plain text: if it contains any tag, treat as HTML; otherwise escape and wrap
  const hasTag = /<\s*(b|strong|i|em|u|s|sub|sup|br|p|ul|ol|li|span|div)[^>]*>/i.test(html);
  if (!hasTag) return null; // caller should render as plain text
  return { __html: sanitizeHtml(html) };
}
