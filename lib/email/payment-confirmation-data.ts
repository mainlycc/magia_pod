/** Stała nazwa załącznika faktury w mailu potwierdzenia płatności. */
export const INVOICE_EMAIL_ATTACHMENT_FILENAME = "Faktura.pdf";

export type PaymentConfirmedEmailParams = {
  /** Publiczny numer umowy / rezerwacji, np. 123456/001 */
  agreementNumber: string;
  contactFirstName: string;
  tripTitle: string;
  attachmentFilenames: string[];
  /** Gdy brak PDF — link do podglądu faktury online */
  invoiceViewUrl?: string | null;
};

export function buildPaymentConfirmedEmailSubject(params: {
  agreementNumber: string;
  tripTitle: string;
}): string {
  return `Potwierdzenie płatności / Faktura ${params.agreementNumber} | ${params.tripTitle}`;
}

export function resolveContactFirstName(
  contactFirstName: string | null | undefined,
  fallbackLastName?: string | null,
): string {
  const first = (contactFirstName ?? "").trim();
  if (first) return first;
  return "";
}
