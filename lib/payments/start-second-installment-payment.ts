import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPaynowPayment } from "@/lib/paynow";

type StartSecondInstallmentInput = {
  adminClient: SupabaseClient;
  baseUrl: string;
  accessToken?: string | null;
  bookingRef?: string | null;
};

export type StartSecondInstallmentResult =
  | { ok: true; redirectUrl: string }
  | {
      ok: false;
      reason: "not_found" | "already_paid" | "no_amount" | "paynow_failed";
      bookingPath?: string;
    };

type BookingRow = {
  id: string;
  booking_ref: string;
  contact_email: string | null;
  access_token: string | null;
  first_payment_status: string | null;
  second_payment_status: string | null;
  second_payment_amount_cents: number | null;
  payment_status: string | null;
  trips: { title: string | null } | { title: string | null }[] | null;
};

function tripTitle(trips: BookingRow["trips"]): string {
  const trip = Array.isArray(trips) ? trips[0] : trips;
  return trip?.title?.trim() || "wycieczka";
}

/** Paynow odrzuca Idempotency-Key dłuższy niż 45 znaków. */
export function buildSecondInstallmentIdempotencyKey(bookingRef: string): string {
  const nonce = crypto.randomBytes(8).toString("hex");
  const head = bookingRef.slice(0, 45 - 1 - nonce.length);
  return `${head}-${nonce}`;
}

export async function startSecondInstallmentPaynowPayment(
  input: StartSecondInstallmentInput,
): Promise<StartSecondInstallmentResult> {
  const accessToken = input.accessToken?.trim() || "";
  const bookingRef = input.bookingRef?.trim() || "";
  if (!accessToken && !bookingRef) {
    return { ok: false, reason: "not_found" };
  }

  let query = input.adminClient
    .from("bookings")
    .select(
      `
      id,
      booking_ref,
      contact_email,
      access_token,
      first_payment_status,
      second_payment_status,
      second_payment_amount_cents,
      payment_status,
      trips:trips!inner(title)
    `,
    );

  query = accessToken ? query.eq("access_token", accessToken) : query.eq("booking_ref", bookingRef);

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }

  const booking = data as BookingRow;
  const token = booking.access_token || accessToken;
  const bookingPath = token ? `/booking/${token}` : undefined;
  const amountCents = booking.second_payment_amount_cents ?? 0;
  const alreadyPaid =
    booking.payment_status === "paid" ||
    booking.payment_status === "overpaid" ||
    booking.second_payment_status === "paid";

  if (alreadyPaid) {
    return { ok: false, reason: "already_paid", bookingPath };
  }

  if (booking.first_payment_status !== "paid" || amountCents <= 0 || !booking.contact_email) {
    return { ok: false, reason: "no_amount", bookingPath };
  }

  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const continueUrl = token
    ? `${baseUrl}/booking/${token}?fromPaynow=1`
    : `${baseUrl}/payments/return?booking_ref=${encodeURIComponent(booking.booking_ref)}`;

  try {
    const payment = await createPaynowPayment({
      amountCents,
      externalId: booking.booking_ref,
      idempotencyKey: buildSecondInstallmentIdempotencyKey(booking.booking_ref),
      description: `Reszta - Rezerwacja ${booking.booking_ref} - ${tripTitle(booking.trips)}`,
      buyerEmail: booking.contact_email,
      continueUrl,
    });

    if (!payment.redirectUrl) {
      return { ok: false, reason: "paynow_failed", bookingPath };
    }

    const { error: insertError } = await input.adminClient.from("payment_history").insert({
      booking_id: booking.id,
      amount_cents: amountCents,
      payment_method: "paynow",
      notes: `Paynow payment ${payment.paymentId} - status: PENDING (initialized) - reszta`,
    });

    if (insertError) {
      console.error("[second-installment] Nie zapisano payment_history:", insertError);
    }

    return { ok: true, redirectUrl: payment.redirectUrl };
  } catch (paynowError) {
    console.error("[second-installment] Paynow init failed:", paynowError);
    return { ok: false, reason: "paynow_failed", bookingPath };
  }
}
