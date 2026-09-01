import { getDefaultPaymentDueDates } from "@/lib/utils/payment-calculator";

export type BookingConfirmationEmailParams = {
  /** Publiczny numer umowy / rezerwacji, np. 123456/001 */
  agreementNumber: string;
  /** Kod wyjazdu (trips.reservation_number), np. 123456 */
  tripNumber: string | null;
  contactFirstName: string;
  contactLastName: string;
  tripTitle: string;
  tripLocation: string | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  participantsCount: number;
  tripTotalPricePln: string;
  depositDeadline: string;
  /** true gdy klient jeszcze nie opłacił rezerwacji online */
  showPaymentInstructions: boolean;
  paymentLink?: string | null;
  attachmentFilenames: string[];
};

type PaymentScheduleRow = {
  installment_number?: number;
  due_date?: string | null;
};

export function formatAgreementPdfFilename(agreementNumber: string): string {
  const safe = agreementNumber.replace(/\//g, "-");
  return `Umowa_${safe}.pdf`;
}

export function buildBookingConfirmationEmailSubject(params: {
  agreementNumber: string;
  tripTitle: string;
}): string {
  return `Potwierdzenie rezerwacji ${params.agreementNumber} | ${params.tripTitle}`;
}

export function formatEmailDateLong(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatEmailDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatPlnFromCents(cents: number): string {
  return (
    (Math.max(0, cents) / 100).toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + " zł"
  );
}

/** Termin zaliczki — pierwsza rata harmonogramu lub domyślny (dzień po rezerwacji). */
export function resolveDepositDeadline(
  paymentSchedule: PaymentScheduleRow[] | null | undefined,
  tripStartDate: string | null,
): string {
  const withDates = (paymentSchedule ?? [])
    .filter((item) => item?.due_date)
    .slice()
    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));

  if (withDates.length > 0) {
    return formatEmailDateShort(withDates[0].due_date ?? null);
  }

  const { depositDueDate } = getDefaultPaymentDueDates(tripStartDate);
  return formatEmailDateShort(depositDueDate);
}

export function resolveContactNames(payload: {
  contact_first_name?: string;
  contact_last_name?: string;
  participants: Array<{ first_name?: string; last_name?: string }>;
}): { firstName: string; lastName: string } {
  const firstName =
    payload.contact_first_name?.trim() ||
    payload.participants[0]?.first_name?.trim() ||
    "";
  const lastName =
    payload.contact_last_name?.trim() ||
    payload.participants[0]?.last_name?.trim() ||
    "";
  return { firstName, lastName };
}
