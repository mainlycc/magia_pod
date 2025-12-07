import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
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

    // Użyj funkcji SQL która omija RLS
    const { data: bookingData, error } = await supabase.rpc("get_booking_by_token", {
      booking_token: token,
    });

    if (error) {
      console.error("Error fetching booking by token:", error);
      return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
    }

    if (!bookingData || bookingData.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingData[0];

    // Pobierz uczestników
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id, first_name, last_name, pesel, email, phone, document_type, document_number")
      .eq("booking_id", booking.id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
      // Kontynuuj bez uczestników
    }

    return NextResponse.json({
      booking: {
        id: booking.id,
        booking_ref: booking.booking_ref,
        contact_email: booking.contact_email,
        contact_phone: booking.contact_phone,
        address: booking.address,
        status: booking.status,
        payment_status: booking.payment_status,
        agreement_pdf_url: booking.agreement_pdf_url,
        created_at: booking.created_at,
        trip: {
          id: booking.trip_id,
          title: booking.trip_title,
          start_date: booking.trip_start_date,
          end_date: booking.trip_end_date,
          price_cents: booking.trip_price_cents,
        },
        participants: participants || [],
      },
    });
  } catch (error) {
    console.error("GET /api/bookings/by-token/[token] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

