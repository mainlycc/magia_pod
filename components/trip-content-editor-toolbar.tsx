"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useRichTextEditorContext } from "@/components/trip-content-editor-context";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripContentEditorToolbarProps {
  editor: Editor | null;
  className?: string;
}

export function TripContentEditorToolbar({
  editor,
  className,
}: TripContentEditorToolbarProps) {
  const disabled = !editor;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 p-2 bg-muted/50 border rounded-lg",
        disabled && "opacity-60",
        className,
      )}
      role="toolbar"
      aria-label="Formatowanie tekstu"
    >
      <Button
        type="button"
        variant={editor?.isActive("bold") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        disabled={disabled || !editor?.can().chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("italic") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
        disabled={disabled || !editor?.can().chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("strike") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
        disabled={disabled || !editor?.can().chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        type="button"
        variant={editor?.isActive("heading", { level: 1 }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        disabled={disabled}
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("heading", { level: 2 }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        disabled={disabled}
      >
        <Heading2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("heading", { level: 3 }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        disabled={disabled}
      >
        <Heading3 className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        type="button"
        variant={editor?.isActive("bulletList") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
        disabled={disabled}
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("orderedList") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        disabled={disabled}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive("blockquote") ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        disabled={disabled}
      >
        <Quote className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        type="button"
        variant={editor?.isActive({ textAlign: "left" }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        disabled={disabled}
      >
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive({ textAlign: "center" }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        disabled={disabled}
      >
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={editor?.isActive({ textAlign: "right" }) ? "default" : "ghost"}
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        disabled={disabled}
      >
        <AlignRight className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().undo().run()}
        disabled={disabled || !editor?.can().chain().focus().undo().run()}
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor?.chain().focus().redo().run()}
        disabled={disabled || !editor?.can().chain().focus().redo().run()}
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function SharedTripContentToolbar({ className }: { className?: string }) {
  const ctx = useRichTextEditorContext();
  const [, setTick] = useState(0);

  useEffect(() => {
    const editor = ctx?.activeEditor;
    if (!editor) return;

    const update = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [ctx?.activeEditor]);

  return (
    <TripContentEditorToolbar editor={ctx?.activeEditor ?? null} className={className} />
  );
}

type ToolbarBounds = {
  top: number;
  left: number;
  width: number;
};

function usePinnedToolbarBounds() {
  const [bounds, setBounds] = useState<ToolbarBounds>({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    const update = () => {
      const inset = document.querySelector('[data-slot="sidebar-inset"]');
      const header = document.querySelector("[data-trip-dashboard-header]");
      if (!inset) return;

      const insetRect = inset.getBoundingClientRect();
      const headerBottom = header
        ? header.getBoundingClientRect().bottom
        : insetRect.top;

      setBounds({
        top: Math.max(headerBottom, 8) + 4,
        left: insetRect.left + 16,
        width: Math.max(0, insetRect.width - 32),
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });

    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    const header = document.querySelector("[data-trip-dashboard-header]");
    const content = document.querySelector("[data-trip-dashboard-content]");
    const observer = new ResizeObserver(update);
    if (inset) observer.observe(inset);
    if (header) observer.observe(header);
    content?.addEventListener("scroll", update, { passive: true });

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      content?.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return bounds;
}

/** Toolbar przypięty do góry obszaru treści — widoczny przy przewijaniu. */
export function PinnedSharedTripContentToolbar() {
  const ctx = useRichTextEditorContext();
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const bounds = usePinnedToolbarBounds();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const editor = ctx?.activeEditor;
    if (!editor) return;

    const update = () => setTick((t) => t + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [ctx?.activeEditor]);

  const toolbar = (
    <div
      className="pointer-events-none fixed z-50"
      style={{
        top: bounds.top,
        left: bounds.left,
        width: bounds.width,
      }}
    >
      <div className="pointer-events-auto rounded-lg border bg-background/95 shadow-md backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <TripContentEditorToolbar
          editor={ctx?.activeEditor ?? null}
          className="border-0 rounded-lg"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Rezerwuje miejsce w układzie strony pod przypięty toolbar */}
      <div className="h-14 shrink-0" aria-hidden />
      {mounted ? createPortal(toolbar, document.body) : null}
    </>
  );
}
