"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import {
  isEmptyRichTextHtml,
  normalizeHtmlForEditor,
  sanitizePastedHtml,
} from "@/lib/agreements/rich-text-html";
import { useRichTextEditorContext } from "@/components/trip-content-editor-context";
import { TripContentEditorToolbar } from "@/components/trip-content-editor-toolbar";
import { cn } from "@/lib/utils";

export type TripContentEditorHandle = {
  getHtml: () => string;
};

interface TripContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  label: string;
  showToolbar?: boolean;
  minHeightClass?: string;
  maxHeightClass?: string;
  autoGrow?: boolean;
  resizable?: boolean;
}

const COMPACT_MIN_HEIGHT_PX = 52;
const COMPACT_MAX_HEIGHT_PX = 384;

function isEmptyEditorHtml(html: string): boolean {
  return isEmptyRichTextHtml(html);
}

export const TripContentEditor = forwardRef<TripContentEditorHandle, TripContentEditorProps>(
  function TripContentEditor(
    {
      content,
      onChange,
      label,
      showToolbar = true,
      minHeightClass = "min-h-[120px]",
      maxHeightClass,
      autoGrow = false,
      resizable = false,
    },
    ref,
  ) {
    const richTextContext = useRichTextEditorContext();
    const richTextContextRef = useRef(richTextContext);
    richTextContextRef.current = richTextContext;
    const showToolbarRef = useRef(showToolbar);
    showToolbarRef.current = showToolbar;

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const editorInstanceRef = useRef<ReturnType<typeof useEditor>>(null);
    const contentContainerRef = useRef<HTMLDivElement>(null);
    const lastEmittedRef = useRef(normalizeHtmlForEditor(content));
    const useCompactLayout = autoGrow || resizable;

    const emitChange = (html: string) => {
      lastEmittedRef.current = html;
      onChangeRef.current(html);
    };

    const syncAutoHeight = useCallback(() => {
      if (!autoGrow) return;
      const container = contentContainerRef.current;
      const ed = editorInstanceRef.current;
      if (!container || !ed) return;

      const prose = container.querySelector(".ProseMirror") as HTMLElement | null;
      if (!prose) return;

      container.style.height = "auto";
      const padding = 32;
      const next = Math.min(
        COMPACT_MAX_HEIGHT_PX,
        Math.max(COMPACT_MIN_HEIGHT_PX, prose.scrollHeight + padding),
      );
      container.style.height = `${next}px`;
    }, [autoGrow]);

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
          class: cn(
            "ProseMirror focus:outline-none p-4 max-w-full break-words [overflow-wrap:anywhere]",
            useCompactLayout ? "min-h-0" : minHeightClass,
          ),
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
        if (autoGrow) {
          requestAnimationFrame(syncAutoHeight);
        }
      },
      onFocus: ({ editor: ed }) => {
        const ctx = richTextContextRef.current;
        if (!showToolbarRef.current && ctx) {
          ctx.setActiveEditor(ed);
        }
      },
      onBlur: ({ editor: ed }) => {
        const ctx = richTextContextRef.current;
        if (!showToolbarRef.current && ctx) {
          window.setTimeout(() => {
            const currentCtx = richTextContextRef.current;
            if (currentCtx?.activeEditor === ed && !ed.isFocused) {
              currentCtx.setActiveEditor(null);
            }
          }, 150);
        }
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
      if (next === lastEmittedRef.current) return;
      if (next === current) {
        lastEmittedRef.current = next;
        return;
      }

      editor.commands.setContent(next, { emitUpdate: false });
      lastEmittedRef.current = next;
      if (autoGrow) {
        requestAnimationFrame(syncAutoHeight);
      }
    }, [content, editor, autoGrow, syncAutoHeight]);

    useEffect(() => {
      if (!editor || !autoGrow) return;
      syncAutoHeight();
      const handler = () => requestAnimationFrame(syncAutoHeight);
      editor.on("create", handler);
      editor.on("transaction", handler);
      return () => {
        editor.off("create", handler);
        editor.off("transaction", handler);
      };
    }, [editor, autoGrow, syncAutoHeight]);

    useEffect(() => {
      if (!editor) return;
      const ed = editor;
      return () => {
        const ctx = richTextContextRef.current;
        if (ctx?.activeEditor === ed) {
          ctx.setActiveEditor(null);
        }
      };
    }, [editor]);

    if (!editor) {
      return null;
    }

    return (
      <div
        className={cn(
          "space-y-2 border rounded-lg",
          resizable ? "overflow-x-hidden" : "overflow-hidden",
        )}
      >
        {label ? (
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
            {label}
          </div>
        ) : null}
        {showToolbar ? (
          <TripContentEditorToolbar editor={editor} className="border-0 border-b rounded-none" />
        ) : null}

        <div
          ref={contentContainerRef}
          className={cn(
            "max-w-full",
            useCompactLayout ? "min-h-[52px] overflow-auto" : "overflow-x-auto",
            useCompactLayout && minHeightClass,
            useCompactLayout && (maxHeightClass ?? "max-h-96"),
            resizable && "resize-y",
          )}
          style={useCompactLayout ? { minHeight: COMPACT_MIN_HEIGHT_PX } : undefined}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  },
);
