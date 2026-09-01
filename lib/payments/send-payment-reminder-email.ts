import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  generatePaymentReminderEmail,
  generatePaymentReminderEmailText,
} from "@/lib/email/templates/payment-reminder";
import {
  buildPaymentReminderAmounts,
  buildPaymentReminderEmailSubject,
  buildPaymentReminderPaymentLink,
  resolvePublicAgreementNumberForBooking,
  toPaymentReminderEmailParams,
} from "@/lib/email/payment-reminder-data";

type TripReminderContext = {
  title: string;
  start_date: string | null;
  end_date?: string | null;
  location?: string | null;
};

type BookingReminderContext = {
  id: string;
  booking_ref: string;
  contact_email: string;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  access_token?: string | null;
  first_payment_amount_cents?: number | null;
  second_payment_amount_cents?: number | null;
  paid_amount_cents?: number | null;
};

export async function sendPaymentReminderForBooking(params: {
  adminClient: SupabaseClient;
  booking: BookingReminderContext;
  trip: TripReminderContext;
  baseUrl: string;
  participants?: Array<{ first_name?: string; last_name?: string }>;
}): Promise<{ ok: boolean; error?: string }> {
  const { adminClient, booking, trip, baseUrl, participants } = params;

  const agreementNumber = await resolvePublicAgreementNumberForBooking(adminClient, booking.id);
  const { totalCents, paidCents, remainingCents } = buildPaymentReminderAmounts({
    firstPaymentAmountCents: booking.first_payment_amount_cents,
    secondPaymentAmountCents: booking.second_payment_amount_cents,
    paidAmountCents: booking.paid_amount_cents,
  });

  const paymentLink = buildPaymentReminderPaymentLink(
    baseUrl,
    booking.access_token,
    booking.booking_ref,
  );

  const emailParams = toPaymentReminderEmailParams({
    agreementNumber,
    contactFirstName: booking.contact_first_name,
    contactLastName: booking.contact_last_name,
    participants,
    tripTitle: trip.title,
    tripLocation: trip.location ?? null,
    tripStartDate: trip.start_date,
    tripEndDate: trip.end_date ?? null,
    totalCents,
    paidCents,
    remainingCents,
    paymentLink,
  });

  const subject = buildPaymentReminderEmailSubject({
    agreementNumber: emailParams.agreementNumber,
    tripTitle: emailParams.tripTitle,
  });

  const result = await sendTransactionalEmail({
    to: booking.contact_email,
    subject,
    html: generatePaymentReminderEmail(emailParams),
    text: generatePaymentReminderEmailText(emailParams),
    logContext: "payment-reminder",
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true };
}
