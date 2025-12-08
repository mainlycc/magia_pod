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

    const supabase = await createClient();

    // Sprawdź czy token to UUID (access_token) czy booking_ref
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(token);

    let bookingData: any[] | null = null;
    let error: any = null;

    if (isUuid) {
      // Token to UUID - użyj funkcji SQL która omija RLS
      const result = await supabase.rpc("get_booking_by_token", {
        booking_token: token,
      });
      bookingData = result.data;
      error = result.error;
    } else {
      // Token to booking_ref - pobierz bezpośrednio z tabeli
      // Używamy admin clienta aby ominąć RLS
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const adminSupabase = createAdminClient();
      
      const { data: booking, error: bookingError } = await adminSupabase
        .from("bookings")
        .select(`
          id,
          booking_ref,
          contact_email,
          contact_phone,
          address,
          status,
          payment_status,
          agreement_pdf_url,
          created_at,
          trip_id,
          trips:trips(id, title, start_date, end_date, price_cents)
        `)
        .eq("booking_ref", token)
        .single();

      if (bookingError || !booking) {
        error = bookingError || new Error("Booking not found");
        bookingData = null;
      } else {
        // Przekształć format do zgodnego z get_booking_by_token
        // trips jest tablicą (nawet dla relacji 1:1), więc bierzemy pierwszy element
        const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
        bookingData = [{
          id: booking.id,
          booking_ref: booking.booking_ref,
          contact_email: booking.contact_email,
          contact_phone: booking.contact_phone,
          address: booking.address,
          status: booking.status,
          payment_status: booking.payment_status,
          agreement_pdf_url: booking.agreement_pdf_url,
          created_at: booking.created_at,
          trip_id: booking.trip_id,
          trip_title: trip?.title || null,
          trip_start_date: trip?.start_date || null,
          trip_end_date: trip?.end_date || null,
          trip_price_cents: trip?.price_cents || null,
        }];
      }
    }

    if (error) {
      console.error("Error fetching booking by token:", error);
      return NextResponse.json({ error: "Failed to fetch booking" }, { status: 500 });
    }

    if (!bookingData || bookingData.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingData[0];

    // Pobierz uczestników - używamy admin clienta aby ominąć RLS dla publicznego dostępu
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();
    
    const { data: participants, error: participantsError } = await adminSupabase
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

