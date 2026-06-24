"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  isEmptyRichTextHtml,
  normalizeHtmlForEditor,
  sanitizePastedHtml,
} from "@/lib/agreements/rich-text-html";

export type TripContentEditorHandle = {
  getHtml: () => string;
};

interface TripContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  label: string;
}

function isEmptyEditorHtml(html: string): boolean {
  return isEmptyRichTextHtml(html);
}

export const TripContentEditor = forwardRef<TripContentEditorHandle, TripContentEditorProps>(
  function TripContentEditor({ content, onChange, label }, ref) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const editorInstanceRef = useRef<ReturnType<typeof useEditor>>(null);
    const lastEmittedRef = useRef(normalizeHtmlForEditor(content));

    const emitChange = (html: string) => {
      lastEmittedRef.current = html;
      onChangeRef.current(html);
    };

    const editor = useEditor({
      extensions: [
        StarterKit,
        TextAlign.configure({
          types: ["heading", "paragraph"],
        }),
      ],
      content: normalizeHtmlForEditor(content),
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "ProseMirror focus:outline-none p-4 min-h-[120px] max-w-full break-words [overflow-wrap:anywhere]",
          "aria-label": label,
        },
        transformPastedHTML: sanitizePastedHtml,
        handleDOMEvents: {
          blur: (_view, event) => {
            const target = event.target as HTMLElement | null;
            if (!target?.closest(".ProseMirror")) return false;
            const ed = editorInstanceRef.current;
            if (ed) emitChange(ed.getHTML());
            return false;
          },
        },
      },
      onUpdate: ({ editor: ed }) => {
        emitChange(ed.getHTML());
      },
    });

    editorInstanceRef.current = editor;

    useImperativeHandle(
      ref,
      () => ({
        getHtml: () => {
          const ed = editorInstanceRef.current;
          if (ed) return ed.getHTML();
          return lastEmittedRef.current || content || "";
        },
      }),
      [content],
    );

    useEffect(() => {
      if (!editor) return;
      if (editor.isFocused) return;

      const next = normalizeHtmlForEditor(content);
      const current = editor.getHTML();

      if (isEmptyEditorHtml(next) && isEmptyEditorHtml(current)) return;
      if (isEmptyEditorHtml(next) && !isEmptyEditorHtml(current)) return;
      // Treść pochodzi z własnego onChange — nie nadpisuj edytora.
      if (next === lastEmittedRef.current) return;
      if (next === current) {
        lastEmittedRef.current = next;
        return;
      }

      editor.commands.setContent(next, { emitUpdate: false });
      lastEmittedRef.current = next;
    }, [content, editor]);

    if (!editor) {
      return null;
    }

    return (
      <div className="space-y-2 border rounded-lg overflow-hidden">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
          {label}
        </div>
        {/* Pasek narzędzi */}
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/50 border-b">
          <Button
            type="button"
            variant={editor.isActive("bold") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("italic") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("strike") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            type="button"
            variant={editor.isActive("heading", { level: 1 }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("heading", { level: 2 }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("heading", { level: 3 }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            type="button"
            variant={editor.isActive("bulletList") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("orderedList") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive("blockquote") ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            type="button"
            variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"}
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-w-full overflow-x-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  },
);
