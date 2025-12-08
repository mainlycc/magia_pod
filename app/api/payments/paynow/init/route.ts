import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPaynowPayment } from "@/lib/paynow";

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
        trips:trips!inner(
          id,
          title,
          price_cents,
          public_slug
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

    // Pobierz liczbę uczestników
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id")
      .eq("booking_id", booking.id);

    if (participantsError) {
      return NextResponse.json(
        { error: "failed_to_fetch_participants" },
        { status: 500 }
      );
    }

    const participantsCount = participants?.length ?? 1;
    const unitPrice = trip.price_cents ?? 0;
    const totalAmountCents = unitPrice * participantsCount;

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

    // Pobierz baseUrl - w produkcji MUSI być ustawiony NEXT_PUBLIC_BASE_URL
    // W przeciwnym razie Paynow przekieruje na localhost zamiast produkcyjnego URL
    const { origin } = new URL(request.url);
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    
    // Jeśli nie ma NEXT_PUBLIC_BASE_URL, sprawdź VERCEL_URL (dla Vercel deployment)
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    
    // Fallback na origin tylko w development (localhost)
    if (!baseUrl) {
      baseUrl = origin;
      console.warn("NEXT_PUBLIC_BASE_URL nie jest ustawione - używany jest origin z requestu. To może powodować problemy w produkcji!");
    }

    // Utwórz URL powrotu
    // Paynow może przekierować z payment_id w parametrach URL, ale na wszelki wypadek
    // będziemy polegać na payment_history do znalezienia payment_id
    const returnUrl = accessToken
      ? `${baseUrl}/booking/${accessToken}`
      : `${baseUrl}/payments/return?booking_ref=${booking.booking_ref}`;

    // Utwórz płatność Paynow v3
    // Uwaga: notificationUrl nie jest obsługiwane w API Paynow v3 - webhooki konfiguruje się w panelu sklepu
    const payment = await createPaynowPayment({
      amountCents: totalAmountCents,
      externalId: booking.booking_ref,
      description: `Rezerwacja ${booking.booking_ref} - ${trip.title}`,
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
    const { createAdminClient } = await import("@/lib/supabase/admin");
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
      console.log(`[Paynow Init] Insert data: booking_id=${booking.id}, amount_cents=${totalAmountCents}, payment_method=paynow`);
      
      // Użyj retry logic, aby upewnić się, że payment_id jest zawsze zapisane
      let retries = 3;
      let insertSuccess = false;
      
      while (retries > 0 && !insertSuccess) {
        const { error: insertError, data: insertedPayment } = await adminClient
          .from("payment_history")
          .insert({
            booking_id: booking.id,
            amount_cents: totalAmountCents,
            payment_method: "paynow",
            notes: `Paynow payment ${payment.paymentId} - status: PENDING (initialized)`,
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
            amountCents: totalAmountCents,
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

