import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPaynowPayment } from "@/lib/paynow";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";
import {
  calculateBookingTotalCents,
  calculateInstallmentAmounts,
} from "@/lib/utils/payment-calculator";

const initPaymentSchema = z.object({
  booking_id: z.string().uuid().optional(),
  booking_ref: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = initPaymentSchema.parse(body);

    if (!payload.booking_id && !payload.booking_ref) {
      return NextResponse.json(
        { error: "booking_id or booking_ref is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Pobierz rezerwację z bazy
    let query = supabase
      .from("bookings")
      .select(
        `
        id,
        booking_ref,
        contact_email,
        trip_id,
        payment_status,
        first_payment_status,
        second_payment_status,
        first_payment_amount_cents,
        second_payment_amount_cents,
        trips:trips!inner(
          id,
          title,
          price_cents,
          public_slug,
          payment_split_enabled,
          payment_split_first_percent,
          payment_split_second_percent,
          payment_schedule
        )
      `
      );

    if (payload.booking_id) {
      query = query.eq("id", payload.booking_id);
    } else if (payload.booking_ref) {
      query = query.eq("booking_ref", payload.booking_ref);
    }

    const { data: booking, error: bookingError } = await query.single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "booking_not_found" },
        { status: 404 }
      );
    }

    // Sprawdź czy rezerwacja ma wycieczkę
    // trips jest tablicą (nawet dla relacji 1:1), więc bierzemy pierwszy element
    const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
    if (!trip || !booking.contact_email) {
      return NextResponse.json(
        { error: "invalid_booking_data" },
        { status: 400 }
      );
    }

    // Pobierz uczestników (z usługami dodatkowymi do wyliczenia kwoty)
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, selected_services")
      .eq("booking_id", booking.id);

    if (participantsError) {
      return NextResponse.json(
        { error: "failed_to_fetch_participants" },
        { status: 500 }
      );
    }

    const participantsCount = participants?.length ?? 1;
    const unitPrice = trip.price_cents ?? 0;
    const totalAmountCents = calculateBookingTotalCents(
      unitPrice,
      participantsCount,
      participants ?? [],
    );

    if (totalAmountCents <= 0) {
      return NextResponse.json(
        { error: "invalid_amount" },
        { status: 400 }
      );
    }

    // Sprawdź czy płatność nie jest już opłacona
    if (booking.payment_status === "paid" || booking.payment_status === "overpaid") {
      return NextResponse.json(
        { error: "payment_already_completed" },
        { status: 400 }
      );
    }

    const paymentConfig = {
      payment_split_enabled: trip.payment_split_enabled,
      payment_split_first_percent: trip.payment_split_first_percent,
      payment_split_second_percent: trip.payment_split_second_percent,
      payment_schedule: trip.payment_schedule,
    };
    const {
      firstPaymentCents,
      secondPaymentCents,
      firstPercent,
    } = calculateInstallmentAmounts(totalAmountCents, paymentConfig);

    const paymentSchedule =
      trip.payment_schedule && Array.isArray(trip.payment_schedule) && trip.payment_schedule.length > 0
        ? trip.payment_schedule
        : null;
    const paymentSplitEnabled = trip.payment_split_enabled ?? true;
    const hasSplitPayments = Boolean(paymentSchedule) || paymentSplitEnabled;

    let paymentAmountCents = totalAmountCents;
    let isFirstPayment = true;
    let paymentDescription = `Rezerwacja ${booking.booking_ref} - ${trip.title}`;

    if (hasSplitPayments) {
      const firstPaymentStatus = booking.first_payment_status ?? "unpaid";
      const secondPaymentStatus = booking.second_payment_status ?? "unpaid";
      const secondInstallment = paymentSchedule && paymentSchedule.length > 1 ? paymentSchedule[1] : null;
      const secondPercent = trip.payment_split_second_percent ?? 70;

      if (firstPaymentStatus === "unpaid") {
        isFirstPayment = true;
        paymentAmountCents = firstPaymentCents;
        paymentDescription = paymentSchedule
          ? `Rata ${paymentSchedule[0].installment_number} (${firstPercent}%) - Rezerwacja ${booking.booking_ref} - ${trip.title}`
          : `Zaliczka (${firstPercent}%) - Rezerwacja ${booking.booking_ref} - ${trip.title}`;
      } else if (firstPaymentStatus === "paid" && secondPaymentStatus === "unpaid" && secondPaymentCents > 0) {
        isFirstPayment = false;
        paymentAmountCents = secondPaymentCents;
        paymentDescription = paymentSchedule && secondInstallment
          ? `Rata ${secondInstallment.installment_number} (${secondInstallment.percent}%) - Rezerwacja ${booking.booking_ref} - ${trip.title}`
          : `Reszta (${secondPercent}%) - Rezerwacja ${booking.booking_ref} - ${trip.title}`;
      } else if (firstPaymentStatus === "paid" && (secondPaymentStatus === "paid" || secondPaymentCents === 0)) {
        return NextResponse.json(
          { error: "payment_already_completed" },
          { status: 400 }
        );
      }

      const adminClient = createAdminClient();
      await adminClient
        .from("bookings")
        .update({
          first_payment_amount_cents: firstPaymentCents,
          second_payment_amount_cents: secondPaymentCents,
        })
        .eq("id", booking.id);
    }

    // Pobierz access_token jeśli istnieje
    let accessToken: string | null = null;
    try {
      const { data: bookingWithToken } = await supabase
        .from("bookings")
        .select("access_token")
        .eq("id", booking.id)
        .single();
      accessToken = bookingWithToken?.access_token || null;
    } catch {
      // Ignoruj błąd - kolumna access_token może nie istnieć
    }

    const { origin } = new URL(request.url);
    const baseUrl = resolvePublicBaseUrl(origin);

    const returnUrl = accessToken
      ? `${baseUrl}/booking/${accessToken}?fromPaynow=1`
      : `${baseUrl}/payments/return?booking_ref=${booking.booking_ref}`;

    // Utwórz płatność Paynow v3
    // Uwaga: notificationUrl nie jest obsługiwane w API Paynow v3 - webhooki konfiguruje się w panelu sklepu
    const payment = await createPaynowPayment({
      amountCents: paymentAmountCents,
      externalId: booking.booking_ref,
      description: paymentDescription,
      buyerEmail: booking.contact_email,
      continueUrl: returnUrl,
    });

    if (!payment.redirectUrl) {
      return NextResponse.json(
        { error: "no_redirect_url" },
        { status: 500 }
      );
    }

    // Zapisz paymentId w payment_history jako pending payment - to pozwoli na sprawdzenie statusu bez webhooków
    // Sprawdź czy już istnieje wpis dla tej rezerwacji z tym paymentId
    // Używamy admin clienta, aby ominąć RLS i mieć pewność, że operacja się powiedzie
    const adminClient = createAdminClient();
    
    // NIE używamy .single() bo zwróci błąd gdy nie ma wpisu
    const { data: existingPayment, error: checkError } = await adminClient
      .from("payment_history")
      .select("id, notes, amount_cents")
      .eq("booking_id", booking.id)
      .like("notes", `%${payment.paymentId}%`)
      .limit(1);

    if (checkError) {
      console.error(`[Paynow Init] Error checking existing payment history:`, checkError);
    }

    if (!existingPayment || existingPayment.length === 0) {
      // Dodaj wpis w historii płatności z paymentId (status pending)
      // WAŻNE: To jest krytyczne dla działania bez webhooków - payment_id musi być zapisane
      console.log(`[Paynow Init] Inserting payment history entry for payment ${payment.paymentId} (PENDING)`);
      console.log(`[Paynow Init] Insert data: booking_id=${booking.id}, amount_cents=${paymentAmountCents}, payment_method=paynow, is_first_payment=${isFirstPayment}`);
      
      // Użyj retry logic, aby upewnić się, że payment_id jest zawsze zapisane
      let retries = 3;
      let insertSuccess = false;
      
      while (retries > 0 && !insertSuccess) {
        const { error: insertError, data: insertedPayment } = await adminClient
          .from("payment_history")
          .insert({
            booking_id: booking.id,
            amount_cents: paymentAmountCents,
            payment_method: "paynow",
            notes: `Paynow payment ${payment.paymentId} - status: PENDING (initialized) - ${isFirstPayment ? "zaliczka" : "reszta"}`,
          })
          .select();

        if (insertError) {
          console.error(`[Paynow Init] ❌ Failed to insert payment history (attempt ${4 - retries}/3):`, {
            error: insertError,
            errorCode: insertError.code,
            errorMessage: insertError.message,
            errorDetails: insertError.details,
            errorHint: insertError.hint,
            bookingId: booking.id,
            paymentId: payment.paymentId,
            amountCents: paymentAmountCents,
            isFirstPayment,
          });
          
          retries--;
          if (retries > 0) {
            // Poczekaj chwilę przed ponowną próbą
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          insertSuccess = true;
          console.log(`[Paynow Init] ✓ Successfully inserted payment history entry:`, insertedPayment);
        }
      }
      
      if (!insertSuccess) {
        console.error(`[Paynow Init] ⚠️ CRITICAL: Failed to insert payment history after 3 attempts. Payment ${payment.paymentId} may not be checkable without webhook!`);
        // Nie zwracamy błędu - płatność została utworzona, ale payment_id nie jest zapisane
        // Użytkownik może ręcznie sprawdzić status przez panel admina
      }
    } else {
      console.log(`[Paynow Init] Payment history entry already exists for payment ${payment.paymentId} (id: ${existingPayment[0].id}, amount: ${existingPayment[0].amount_cents})`);
    }

    return NextResponse.json({
      redirectUrl: payment.redirectUrl,
      paymentId: payment.paymentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "invalid_payload", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Paynow")) {
      console.error("Paynow payment initialization error:", error);
      return NextResponse.json(
        { error: "payment_initialization_failed", message: error.message },
        { status: 500 }
      );
    }

    console.error("POST /api/payments/paynow/init error:", error);
    return NextResponse.json(
      { error: "unexpected_error" },
      { status: 500 }
    );
  }
}

