import {
  formatEmailDateLong,
  formatPlnFromCents,
  resolveContactNames,
} from "@/lib/email/booking-confirmation-data";

export type PaymentReminderEmailParams = {
  /** Publiczny numer umowy / rezerwacji, np. 123456/001 */
  agreementNumber: string;
  contactFirstName: string;
  tripTitle: string;
  tripLocation: string | null;
  tripStartDate: string | null;
  tripEndDate: string | null;
  tripTotalPricePln: string;
  amountPaidPln: string;
  amountRemainingPln: string;
  paymentLink: string;
};

export function buildPaymentReminderEmailSubject(params: {
  agreementNumber: string;
  tripTitle: string;
}): string {
  return `Przypomnienie o płatności ${params.agreementNumber} | ${params.tripTitle}`;
}

export function buildPaymentReminderPaymentLink(
  baseUrl: string,
  accessToken: string | null | undefined,
  bookingRef?: string | null,
): string {
  const base = baseUrl.replace(/\/$/, "");
  if (accessToken) {
    return `${base}/booking/${accessToken}?payment=second`;
  }
  if (bookingRef) {
    return `${base}/payments/paynow/init?booking_ref=${encodeURIComponent(bookingRef)}&payment=second`;
  }
  return base;
}

export function buildPaymentReminderAmounts(params: {
  firstPaymentAmountCents?: number | null;
  secondPaymentAmountCents?: number | null;
  paidAmountCents?: number | null;
}): {
  totalCents: number;
  paidCents: number;
  remainingCents: number;
} {
  const first = Math.max(0, params.firstPaymentAmountCents ?? 0);
  const second = Math.max(0, params.secondPaymentAmountCents ?? 0);
  const totalFromInstallments = first + second;
  const paidCents = Math.max(0, params.paidAmountCents ?? 0);

  const totalCents = totalFromInstallments > 0 ? totalFromInstallments : paidCents + second;
  const remainingCents =
    totalCents > paidCents ? totalCents - paidCents : Math.max(0, second);

  return { totalCents, paidCents, remainingCents };
}

export function toPaymentReminderEmailParams(input: {
  agreementNumber: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  participants?: Array<{ first_name?: string; last_name?: string }>;
  tripTitle: string;
  tripLocation?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  paymentLink: string;
}): PaymentReminderEmailParams {
  const { firstName } = resolveContactNames({
    contact_first_name: input.contactFirstName ?? undefined,
    contact_last_name: input.contactLastName ?? undefined,
    participants: input.participants ?? [],
  });

  return {
    agreementNumber: input.agreementNumber,
    contactFirstName: firstName,
    tripTitle: input.tripTitle,
    tripLocation: input.tripLocation ?? null,
    tripStartDate: input.tripStartDate ?? null,
    tripEndDate: input.tripEndDate ?? null,
    tripTotalPricePln: formatPlnFromCents(input.totalCents),
    amountPaidPln: formatPlnFromCents(input.paidCents),
    amountRemainingPln: formatPlnFromCents(input.remainingCents),
    paymentLink: input.paymentLink,
  };
}

export async function resolvePublicAgreementNumberForBooking(
  adminClient: {
    from: (table: string) => any;
  },
  bookingId: string,
): Promise<string> {
  try {
    const { formatAgreementNumber } = await import("@/lib/agreements/format-agreement-number");

    const { data: agreementRow } = await adminClient
      .from("agreements")
      .select("agreement_seq")
      .eq("booking_id", bookingId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const { data: bookingRow } = await adminClient
      .from("bookings")
      .select("trip_id, trips:trips(reservation_number)")
      .eq("id", bookingId)
      .single();

    const trip = Array.isArray(bookingRow?.trips) ? bookingRow.trips[0] : bookingRow?.trips;
    const formatted = formatAgreementNumber({
      reservationNumber: trip?.reservation_number ?? null,
      agreementSeq: typeof agreementRow?.agreement_seq === "number" ? agreementRow.agreement_seq : null,
    }).replace(/^#/, "");

    return formatted === "-" ? "—" : formatted;
  } catch {
    return "—";
  }
}

export { formatEmailDateLong };
