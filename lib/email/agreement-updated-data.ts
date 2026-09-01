export type AgreementUpdatedEmailParams = {
  /** Publiczny numer umowy / rezerwacji, np. 123456/001 */
  agreementNumber: string;
  contactFirstName: string;
  tripTitle: string;
  attachmentFilename: string;
};

export const UPDATED_AGREEMENT_ATTACHMENT_PREFIX = "Zaktualizowana_Umowa";

export function formatUpdatedAgreementPdfFilename(agreementNumber: string): string {
  const safe = agreementNumber.replace(/\//g, "-");
  return `${UPDATED_AGREEMENT_ATTACHMENT_PREFIX}_${safe}.pdf`;
}

export function buildAgreementUpdatedEmailSubject(params: {
  agreementNumber: string;
  tripTitle: string;
}): string {
  return `Zaktualizowana umowa ${params.agreementNumber} | ${params.tripTitle}`;
}
