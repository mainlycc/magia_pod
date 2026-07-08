"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/react";

type RichTextEditorContextValue = {
  activeEditor: Editor | null;
  setActiveEditor: (editor: Editor | null) => void;
};

const RichTextEditorContext = createContext<RichTextEditorContextValue | null>(null);

export function RichTextEditorProvider({ children }: { children: ReactNode }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);

  const value = useMemo(
    () => ({ activeEditor, setActiveEditor }),
    [activeEditor],
  );

  return (
    <RichTextEditorContext.Provider value={value}>
      {children}
    </RichTextEditorContext.Provider>
  );
}

export function useRichTextEditorContext() {
  return useContext(RichTextEditorContext);
}
