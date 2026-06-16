export const INSURANCE_OWU_TYPES = [1, 2, 3] as const;

export type InsuranceOwuType = (typeof INSURANCE_OWU_TYPES)[number];

export const INSURANCE_OWU_TYPE_LABELS: Record<InsuranceOwuType, string> = {
  1: "Typ 1 — Podstawowe (PZU)",
  2: "Typ 2 — Dodatkowe medyczne (TU Europa)",
  3: "Typ 3 — KR (TU Europa)",
};

export function isValidInsuranceOwuType(value: unknown): value is InsuranceOwuType {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  return n === 1 || n === 2 || n === 3;
}

export function buildDefaultOwuEmailSettings(): Record<InsuranceOwuType, boolean> {
  return { 1: true, 2: true, 3: true };
}
