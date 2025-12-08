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

    const { origin } = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? origin;

    // Utwórz URL powrotu
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

    // Zapisz paymentId w payment_history jako pending payment (na wypadek gdyby webhook nie zadziałał)
    // Sprawdź czy już istnieje wpis dla tej rezerwacji z tym paymentId
    const { data: existingPayment } = await supabase
      .from("payment_history")
      .select("id")
      .eq("booking_id", booking.id)
      .like("notes", `%${payment.paymentId}%`)
      .single();

    if (!existingPayment) {
      // Dodaj wpis w historii płatności z paymentId (status pending)
      await supabase.from("payment_history").insert({
        booking_id: booking.id,
        amount_cents: totalAmountCents,
        payment_method: "paynow",
        notes: `Paynow payment ${payment.paymentId} - status: PENDING (initialized)`,
      });
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

