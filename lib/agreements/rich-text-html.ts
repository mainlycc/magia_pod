/** TipTap / HTML z edytora — czy blok jest faktycznie pusty. */
export function isEmptyRichTextHtml(html: string | null | undefined): boolean {
  const trimmed = (html ?? "").trim();
  if (!trimmed) return true;
  const textOnly = trimmed
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .trim();
  return textOnly.length === 0;
}

/** Preferuje niepustą treść z edytora lub ze stanu sekcji. */
export function resolveRichTextContent(
  stateContent: string | undefined,
  editorHtml: string | undefined,
): string {
  const fromEditor = editorHtml ?? "";
  const fromState = stateContent ?? "";

  if (!isEmptyRichTextHtml(fromEditor)) return fromEditor;
  if (!isEmptyRichTextHtml(fromState)) return fromState;
  return fromEditor || fromState;
}

/** Przygotowuje HTML sekcji do wczytania w TipTap (np. po parseHtmlToTemplate). */
export function normalizeHtmlForEditor(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  return html.trim();
}

/** Czyści HTML wklejany z Worda / innych edytorów — usuwa style i zbędne tagi. */
export function sanitizePastedHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(\/?)(meta|link|style|script|o:p|w:[^>]+|v:[^>]+|st1:[^>]+)[^>]*>/gi, "")
    .replace(/\sstyle="[^"]*"/gi, "")
    .replace(/\sclass="[^"]*"/gi, "")
    .replace(/<span>([^<]*)<\/span>/gi, "$1");
}
