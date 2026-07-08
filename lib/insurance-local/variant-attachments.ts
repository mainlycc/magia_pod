export const INSURANCE_VARIANT_ATTACHMENT_TYPES = ["owu", "other"] as const;

export type InsuranceVariantAttachmentType = (typeof INSURANCE_VARIANT_ATTACHMENT_TYPES)[number];

export function isValidVariantAttachmentType(
  value: unknown,
): value is InsuranceVariantAttachmentType {
  return value === "owu" || value === "other";
}

export const VARIANT_ATTACHMENT_TYPE_LABELS: Record<InsuranceVariantAttachmentType, string> = {
  owu: "OWU",
  other: "Inny załącznik",
};

export function variantAttachmentPublicUrl(fileName: string): string {
  return `/api/documents/file/${fileName}`;
}
