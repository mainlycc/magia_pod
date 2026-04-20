import type { SupabaseClient } from "@supabase/supabase-js";

const INSTALLMENT_SUM_TOLERANCE_CENTS = 2;

/**
 * Statusy rat przy podziale płatności — spójne z {@link recalculateBookingPaymentsFromHistory}.
 * Gdy suma rat z rezerwacji ≠ cenie wycieczki, „druga rata” jest uznana za zapłaconą przy pełnej wpłacie (cena wycieczki).
 */
export function deriveInstallmentStatuses(
  totalPaidCents: number,
  tripPriceCents: number,
  firstPaymentAmountCents: number,
  secondPaymentAmountCents: number,
): { first_payment_status: "paid" | "unpaid" | null; second_payment_status: "paid" | "unpaid" | null } {
  const firstAmount = firstPaymentAmountCents ?? 0;
  const secondAmount = secondPaymentAmountCents ?? 0;
  const installmentsSum = firstAmount + secondAmount;

  let amountDue = tripPriceCents > 0 ? tripPriceCents : installmentsSum;
  if (amountDue <= 0 && installmentsSum > 0) {
    amountDue = installmentsSum;
  }

  const installmentsAligned =
    installmentsSum <= 0 ||
    amountDue <= 0 ||
    Math.abs(installmentsSum - amountDue) <= INSTALLMENT_SUM_TOLERANCE_CENTS;

  const first_payment_status =
    firstAmount > 0
      ? totalPaidCents >= (installmentsAligned ? firstAmount : Math.min(firstAmount, amountDue))
        ? "paid"
        : "unpaid"
      : null;
  const second_payment_status =
    secondAmount > 0 ? (totalPaidCents >= amountDue ? "paid" : "unpaid") : null;

  return { first_payment_status, second_payment_status };
}

async function getTripPrice(supabase: SupabaseClient, tripId: string): Promise<number> {
  const { data } = await supabase.from("trips").select("price_cents").eq("id", tripId).single();
  return data?.price_cents ?? 0;
}

/**
 * Ustawia paid_amount_cents i statusy płatności na podstawie sumy wpisów w payment_history.
 * Ta sama logika co POST/DELETE /api/bookings/[id]/payments — Paynow webhook musi ją wywołać,
 * bo wpisy historii nie aktualizują same bookings.paid_amount_cents.
 */
export async function recalculateBookingPaymentsFromHistory(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<
  | { ok: true; totalPaid: number; paymentStatus: "unpaid" | "partial" | "paid" | "overpaid" }
  | { ok: false; error: string }
> {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
      id,
      trip_id,
      first_payment_amount_cents,
      second_payment_amount_cents,
      trips:trips(price_cents)
    `,
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return { ok: false, error: bookingError?.message ?? "booking_not_found" };
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payment_history")
    .select("amount_cents")
    .eq("booking_id", bookingId);

  if (paymentsError) {
    return { ok: false, error: paymentsError.message };
  }

  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) ?? 0;
  const trip =
    Array.isArray((booking as { trips?: unknown }).trips)
      ? (booking as { trips: { price_cents?: number }[] }).trips[0]
      : (booking as { trips?: { price_cents?: number } }).trips;
  let tripPrice =
    trip?.price_cents ??
    (booking.trip_id ? await getTripPrice(supabase, booking.trip_id) : 0);

  let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = "unpaid";
  if (totalPaid >= tripPrice) {
    newPaymentStatus = totalPaid > tripPrice ? "overpaid" : "paid";
  } else if (totalPaid > 0) {
    newPaymentStatus = "partial";
  }

  const { first_payment_status: firstPaymentStatus, second_payment_status: secondPaymentStatus } =
    deriveInstallmentStatuses(totalPaid, tripPrice, booking.first_payment_amount_cents ?? 0, booking.second_payment_amount_cents ?? 0);

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      paid_amount_cents: totalPaid,
      payment_status: newPaymentStatus,
      ...(firstPaymentStatus ? { first_payment_status: firstPaymentStatus } : {}),
      ...(secondPaymentStatus ? { second_payment_status: secondPaymentStatus } : {}),
    })
    .eq("id", bookingId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, totalPaid, paymentStatus: newPaymentStatus };
}
