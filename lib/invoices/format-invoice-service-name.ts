import {
  AGREEMENT_NUMBER_SPEC,
  formatAgreementNumber,
} from "@/lib/agreements/agreement-number-spec";

/** Treść uwag (description) na automatycznej fakturze zaliczkowej. */
export const INVOICE_VAT_MARGIN_NOTE = "Faktura VAT-marża dla biur podróży";

export type InvoiceServiceNameInput = {
  title: string;
  startDate?: string | null;
  endDate?: string | null;
  reservationNumber?: string | null;
  agreementSeq?: number | null;
};

type DateParts = { day: number; month: number; year: number };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateParts(dateString: string | null | undefined): DateParts | null {
  if (!dateString) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateString.trim());
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

function formatDayMonthYear(parts: DateParts): string {
  return `${pad2(parts.day)}.${pad2(parts.month)}.${parts.year}`;
}

/** Kompaktowy zakres dat wyjazdu na fakturze, np. `03-04.12.2026`. */
export function formatInvoiceTripDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const start = parseDateParts(startDate);
  if (!start) return "";

  const end = parseDateParts(endDate);
  if (!end || (start.day === end.day && start.month === end.month && start.year === end.year)) {
    return formatDayMonthYear(start);
  }

  if (start.year === end.year && start.month === end.month) {
    return `${pad2(start.day)}-${pad2(end.day)}.${pad2(start.month)}.${start.year}`;
  }

  if (start.year === end.year) {
    return `${pad2(start.day)}.${pad2(start.month)}-${pad2(end.day)}.${pad2(end.month)}.${start.year}`;
  }

  return `${formatDayMonthYear(start)}-${formatDayMonthYear(end)}`;
}

function formatReservationRef(
  reservationNumber: string | null | undefined,
  agreementSeq: number | null | undefined,
): string | null {
  const formatted = formatAgreementNumber({
    reservationNumber,
    agreementSeq,
  });

  if (!formatted || formatted === AGREEMENT_NUMBER_SPEC.missingValue) {
    return null;
  }

  return formatted;
}

/**
 * Buduje nazwę towaru/usługi na fakturze Fakturowni.
 * Przykład: `Praga - złoty skarbiec Czech, 03-04.12.2026, #130426/001`
 */
export function buildInvoiceServiceName(input: InvoiceServiceNameInput): string {
  const parts: string[] = [input.title.trim()];

  const dateRange = formatInvoiceTripDateRange(input.startDate, input.endDate);
  if (dateRange) parts.push(dateRange);

  const reservationRef = formatReservationRef(input.reservationNumber, input.agreementSeq);
  if (reservationRef) parts.push(reservationRef);

  return parts.join(", ");
}
