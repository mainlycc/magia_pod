import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const params = await (context.params instanceof Promise ? context.params : Promise.resolve(context.params));
    const { token } = params;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Walidacja formatu UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Pobierz rezerwację po tokenie
    const { data: bookingData, error: bookingError } = await supabase.rpc("get_booking_by_token", {
      booking_token: token,
    });

    if (bookingError || !bookingData || bookingData.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingData[0];

    // Sprawdź czy płatność nie została już dokonana
    if (booking.payment_status === "paid" || booking.payment_status === "overpaid") {
      return NextResponse.json(
        { error: "Payment already completed", payment_status: booking.payment_status },
        { status: 400 }
      );
    }

    // Pobierz dane płatności z body (opcjonalne, dla symulacji)
    const body = await request.json().catch(() => ({}));
    const paymentData = body as {
      card_number?: string;
      card_holder?: string;
      amount?: number;
    };

    // Użyj admin client do aktualizacji (omija RLS)
    const supabaseAdmin = createAdminClient();

    // Aktualizuj status płatności
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "paid",
      })
      .eq("id", booking.id);

    if (updateError) {
      console.error("Error updating payment status:", updateError);
      return NextResponse.json({ error: "Failed to update payment status" }, { status: 500 });
    }

    // Opcjonalnie: Dodaj wpis do payment_history (jeśli tabela istnieje)
    try {
      const tripPrice = booking.trip_price_cents || 0;
      if (tripPrice > 0) {
        await supabaseAdmin.from("payment_history").insert({
          booking_id: booking.id,
          amount_cents: tripPrice,
          payment_date: new Date().toISOString().split("T")[0],
          payment_method: "card_simulation",
          notes: "Symulacja płatności - test",
        });
      }
    } catch (historyError) {
      // Ignoruj błąd jeśli payment_history nie istnieje lub jest problem
      console.warn("Could not add payment history:", historyError);
    }

    return NextResponse.json({
      success: true,
      message: "Payment simulated successfully",
      payment_status: "paid",
      booking_ref: booking.booking_ref,
    });
  } catch (error) {
    console.error("POST /api/bookings/by-token/[token]/simulate-payment error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

