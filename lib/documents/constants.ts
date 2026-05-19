export const DOCUMENT_TYPES = [
  "rodo",
  "terms",
  "conditions",
  "agreement",
  "conditions_de_pl",
  "standard_form",
  "electronic_services",
  "rodo_info",
  "insurance_terms",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Typy widoczne w zakładce Dokumentacja (trip-dashboard) */
export const DOCUMENTATION_UI_TYPES = [
  "agreement",
  "conditions_de_pl",
  "standard_form",
  "electronic_services",
  "rodo_info",
  "insurance_terms",
] as const;

export type DocumentationUiDocumentType = (typeof DOCUMENTATION_UI_TYPES)[number];

export function isValidDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function buildDefaultEmailSettings(): Record<DocumentType, boolean> {
  return Object.fromEntries(DOCUMENT_TYPES.map((t) => [t, true])) as Record<DocumentType, boolean>;
}
