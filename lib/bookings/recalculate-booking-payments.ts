import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateBookingTotalCents } from "@/lib/utils/payment-calculator";
import { countsTowardPaidAmount } from "@/lib/bookings/payment-history-counts";

const INSTALLMENT_SUM_TOLERANCE_CENTS = 2;

export type BookingPaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";

/**
 * Status płatności względem pełnej należności rezerwacji
 * (cena × aktywni uczestnicy + usługi dodatkowe PLN).
 */
export function derivePaymentStatus(
  totalPaidCents: number,
  amountDueCents: number,
): BookingPaymentStatus {
  const paid = Math.max(0, totalPaidCents || 0);
  const due = Math.max(0, amountDueCents || 0);

  if (due <= 0) {
    return paid > 0 ? "overpaid" : "unpaid";
  }
  if (paid <= 0) return "unpaid";
  if (paid < due) return "partial";
  if (paid > due) return "overpaid";
  return "paid";
}

/**
 * Statusy rat przy podziale płatności — spójne z {@link recalculateBookingPaymentsFromHistory}.
 * `amountDueCents` to pełna należność umowy (nie sama cena 1 osoby).
 * Gdy suma rat ≠ należności, „druga rata” jest uznana za zapłaconą przy pełnej wpłacie.
 */
export function deriveInstallmentStatuses(
  totalPaidCents: number,
  amountDueCents: number,
  firstPaymentAmountCents: number,
  secondPaymentAmountCents: number,
): { first_payment_status: "paid" | "unpaid" | null; second_payment_status: "paid" | "unpaid" | null } {
  const firstAmount = firstPaymentAmountCents ?? 0;
  const secondAmount = secondPaymentAmountCents ?? 0;
  const installmentsSum = firstAmount + secondAmount;

  let amountDue = amountDueCents > 0 ? amountDueCents : installmentsSum;
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

type TripForDue = {
  price_cents?: number | null;
  form_diets?: unknown;
  form_extra_insurances?: unknown;
  form_additional_attractions?: unknown;
};

type ParticipantForDue = {
  is_active?: boolean | null;
  selected_services?: unknown;
};

/**
 * Pełna należność rezerwacji — ta sama baza co lista uczestników / Fakturownia:
 * cena wycieczki × aktywni uczestnicy + usługi dodatkowe (PLN).
 */
export function calculateBookingAmountDueCents(
  trip: TripForDue | null | undefined,
  participants: readonly ParticipantForDue[] | null | undefined,
): number {
  const tripPrice = trip?.price_cents ?? 0;
  const active = (participants ?? []).filter((p) => p?.is_active !== false);
  const count = active.length > 0 ? active.length : 1;

  return calculateBookingTotalCents(
    tripPrice,
    count,
    active.length > 0 ? active : [],
    undefined,
    {
      form_diets: trip?.form_diets,
      form_extra_insurances: trip?.form_extra_insurances,
      form_additional_attractions: trip?.form_additional_attractions,
    },
  );
}

async function getTripForDue(
  supabase: SupabaseClient,
  tripId: string,
): Promise<TripForDue | null> {
  const { data } = await supabase
    .from("trips")
    .select("price_cents, form_diets, form_extra_insurances, form_additional_attractions")
    .eq("id", tripId)
    .single();
  return data ?? null;
}

/**
 * Ustawia paid_amount_cents i statusy płatności na podstawie sumy wpisów w payment_history
 * oraz pełnej należności (osoby + usługi).
 * Ta sama logika co POST/DELETE /api/bookings/[id]/payments — Paynow webhook musi ją wywołać,
 * bo wpisy historii nie aktualizują same bookings.paid_amount_cents.
 */
export async function recalculateBookingPaymentsFromHistory(
  supabase: SupabaseClient,
  bookingId: string,
): Promise<
  | { ok: true; totalPaid: number; amountDue: number; paymentStatus: BookingPaymentStatus }
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
      trips:trips(
        price_cents,
        form_diets,
        form_extra_insurances,
        form_additional_attractions
      )
    `,
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return { ok: false, error: bookingError?.message ?? "booking_not_found" };
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payment_history")
    .select("amount_cents, payment_method, notes")
    .eq("booking_id", bookingId);

  if (paymentsError) {
    return { ok: false, error: paymentsError.message };
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("is_active, selected_services")
    .eq("booking_id", bookingId);

  if (participantsError) {
    return { ok: false, error: participantsError.message };
  }

  const totalPaid =
    payments?.reduce((sum, p) => {
      if (!countsTowardPaidAmount(p)) return sum;
      return sum + (p.amount_cents || 0);
    }, 0) ?? 0;
  const tripFromJoin =
    Array.isArray((booking as { trips?: unknown }).trips)
      ? (booking as { trips: TripForDue[] }).trips[0]
      : (booking as { trips?: TripForDue }).trips;

  const trip =
    tripFromJoin ??
    (booking.trip_id ? await getTripForDue(supabase, booking.trip_id) : null);

  const amountDue = calculateBookingAmountDueCents(trip, participants);
  const newPaymentStatus = derivePaymentStatus(totalPaid, amountDue);

  const { first_payment_status: firstPaymentStatus, second_payment_status: secondPaymentStatus } =
    deriveInstallmentStatuses(
      totalPaid,
      amountDue,
      booking.first_payment_amount_cents ?? 0,
      booking.second_payment_amount_cents ?? 0,
    );

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

  return { ok: true, totalPaid, amountDue, paymentStatus: newPaymentStatus };
}
