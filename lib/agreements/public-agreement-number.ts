import { formatAgreementNumber } from "@/lib/agreements/format-agreement-number";

export function formatPublicAgreementNumber(opts: {
  reservationNumber?: string | null;
  agreementSeq?: number | null;
}): string {
  return formatAgreementNumber(opts).replace(/^#/, "");
}

