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
          trips:trips(
            id,
            title,
            start_date,
            end_date,
            price_cents,
            reservation_number,
            company_participants_info,
            reservation_success_message,
            payment_split_enabled,
            payment_split_first_percent,
            payment_split_second_percent,
            payment_schedule,
            form_diets,
            form_extra_insurances,
            form_additional_attractions
          )
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
          trip_reservation_number: trip?.reservation_number ?? null,
          trip_company_participants_info: trip?.company_participants_info ?? null,
          trip_reservation_success_message: trip?.reservation_success_message ?? null,
          trip_payment_split_enabled: trip?.payment_split_enabled ?? null,
          trip_payment_split_first_percent: trip?.payment_split_first_percent ?? null,
          trip_payment_split_second_percent: trip?.payment_split_second_percent ?? null,
          trip_payment_schedule: trip?.payment_schedule ?? null,
          trip_form_diets: trip?.form_diets ?? null,
          trip_form_extra_insurances: trip?.form_extra_insurances ?? null,
          trip_form_additional_attractions: trip?.form_additional_attractions ?? null,
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

    // Dociągnij brakujące pola wycieczki (RPC może ich nie zwracać w części środowisk)
    if (booking.trip_id && (!booking.trip_title || !booking.trip_start_date || booking.trip_price_cents == null)) {
      const { data: tripRow, error: tripErr } = await adminSupabase
        .from("trips")
        .select(
          "title, start_date, end_date, price_cents, reservation_number, company_participants_info, reservation_success_message, payment_split_enabled, payment_split_first_percent, payment_split_second_percent, payment_schedule, form_diets, form_extra_insurances, form_additional_attractions",
        )
        .eq("id", booking.trip_id)
        .single();

      if (tripErr) {
        console.error("Error fetching trip fallback for booking token:", tripErr);
      } else if (tripRow) {
        booking.trip_title = booking.trip_title ?? tripRow.title ?? null;
        booking.trip_start_date = booking.trip_start_date ?? tripRow.start_date ?? null;
        booking.trip_end_date = booking.trip_end_date ?? tripRow.end_date ?? null;
        booking.trip_price_cents = booking.trip_price_cents ?? tripRow.price_cents ?? null;
        booking.trip_reservation_number = booking.trip_reservation_number ?? tripRow.reservation_number ?? null;
        booking.trip_company_participants_info =
          booking.trip_company_participants_info ?? tripRow.company_participants_info ?? null;
        booking.trip_reservation_success_message =
          booking.trip_reservation_success_message ?? tripRow.reservation_success_message ?? null;
        booking.trip_payment_split_enabled = booking.trip_payment_split_enabled ?? tripRow.payment_split_enabled ?? null;
        booking.trip_payment_split_first_percent = booking.trip_payment_split_first_percent ?? tripRow.payment_split_first_percent ?? null;
        booking.trip_payment_split_second_percent = booking.trip_payment_split_second_percent ?? tripRow.payment_split_second_percent ?? null;
        booking.trip_payment_schedule = booking.trip_payment_schedule ?? tripRow.payment_schedule ?? null;
        booking.trip_form_diets = booking.trip_form_diets ?? tripRow.form_diets ?? null;
        booking.trip_form_extra_insurances = booking.trip_form_extra_insurances ?? tripRow.form_extra_insurances ?? null;
        booking.trip_form_additional_attractions = booking.trip_form_additional_attractions ?? tripRow.form_additional_attractions ?? null;
      }
    }

    // Uzupełnij reservation_number jeśli RPC/format go nie zwrócił
    let tripReservationNumber: string | null =
      typeof booking.trip_reservation_number === "string"
        ? booking.trip_reservation_number
        : null;
    if (booking.trip_reservation_number === undefined && booking.trip_id) {
      const { data: tripRow } = await adminSupabase
        .from("trips")
        .select("reservation_number")
        .eq("id", booking.trip_id)
        .single();
      tripReservationNumber = tripRow?.reservation_number ?? null;
    }

    let tripCompanyParticipantsInfo: string | null =
      typeof booking.trip_company_participants_info === "string"
        ? booking.trip_company_participants_info
        : null;
    if (booking.trip_company_participants_info === undefined && booking.trip_id) {
      const { data: tripRow } = await adminSupabase
        .from("trips")
        .select("company_participants_info, reservation_success_message")
        .eq("id", booking.trip_id)
        .single();
      tripCompanyParticipantsInfo = tripRow?.company_participants_info ?? null;
    }

    let tripReservationSuccessMessage: string | null =
      typeof booking.trip_reservation_success_message === "string"
        ? booking.trip_reservation_success_message
        : null;

    if (booking.trip_reservation_success_message === undefined && booking.trip_id) {
      const { data: tripRow } = await adminSupabase
        .from("trips")
        .select("reservation_success_message")
        .eq("id", booking.trip_id)
        .single();

      tripReservationSuccessMessage = tripRow?.reservation_success_message ?? tripReservationSuccessMessage;
    }

    // Pobierz numer kolejny umowy (agreement_seq) dla tej rezerwacji
    let agreementSeq: number | null = null;
    try {
      const { data: agreementRow, error: agreementError } = await adminSupabase
        .from("agreements")
        .select("agreement_seq, status, updated_at, generated_at")
        .eq("booking_id", booking.id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("generated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (agreementError && agreementError.code !== "PGRST116") {
        console.error("Error fetching agreement for booking:", agreementError);
      }
      const seq = agreementRow?.agreement_seq;
      agreementSeq = typeof seq === "number" && seq > 0 ? seq : null;
    } catch (e) {
      console.error("Agreement lookup failed:", e);
    }
    
    const { data: participants, error: participantsError } = await adminSupabase
      .from("participants")
      .select("id, first_name, last_name, pesel, email, phone, document_type, document_number, selected_services")
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
        agreement_seq: agreementSeq,
        created_at: booking.created_at,
        trip: {
          id: booking.trip_id,
          title: booking.trip_title,
          start_date: booking.trip_start_date,
          end_date: booking.trip_end_date,
          price_cents: booking.trip_price_cents,
          reservation_number: tripReservationNumber,
          company_participants_info: tripCompanyParticipantsInfo,
          reservation_success_message: tripReservationSuccessMessage,
          payment_split_enabled: booking.trip_payment_split_enabled ?? null,
          payment_split_first_percent: booking.trip_payment_split_first_percent ?? null,
          payment_split_second_percent: booking.trip_payment_split_second_percent ?? null,
          payment_schedule: booking.trip_payment_schedule ?? null,
          form_diets: booking.trip_form_diets ?? null,
          form_extra_insurances: booking.trip_form_extra_insurances ?? null,
          form_additional_attractions: booking.trip_form_additional_attractions ?? null,
        },
        participants: participants || [],
      },
    });
  } catch (error) {
    console.error("GET /api/bookings/by-token/[token] error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

