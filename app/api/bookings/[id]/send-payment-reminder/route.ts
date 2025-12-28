import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePaymentReminderEmail } from "@/lib/email/templates/payment-reminder";

// Helper do sprawdzenia czy użytkownik to admin
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

// Helper do sprawdzenia czy użytkownik to koordynator przypisany do wycieczki
async function checkCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string
): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, allowed_trip_ids")
    .eq("id", userId)
    .single();

  if (profile?.role !== "coordinator") return false;
  if (!profile.allowed_trip_ids) return false;

  return profile.allowed_trip_ids.includes(tripId);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Sprawdź uprawnienia
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      // Sprawdź czy to koordynator - najpierw musimy pobrać trip_id
      const { data: booking } = await supabase
        .from("bookings")
        .select("trip_id")
        .eq("id", id)
        .single();

      if (!booking) {
        return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
      }

      const isCoordinator = await checkCoordinator(supabase, booking.trip_id);
      if (!isCoordinator) {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
    }

    // Pobierz booking z trip
    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select(`
        id,
        booking_ref,
        contact_email,
        trip_id,
        first_payment_status,
        second_payment_status,
        second_payment_amount_cents,
        reminder_sent_at,
        access_token,
        trips:trips!inner(
          id,
          title,
          start_date,
          payment_split_enabled,
          payment_split_second_percent
        )
      `)
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }

    const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;

    // Sprawdź czy podział płatności jest włączony
    const paymentSplitEnabled = trip?.payment_split_enabled ?? true;
    if (!paymentSplitEnabled) {
      return NextResponse.json(
        { error: "payment_split_not_enabled" },
        { status: 400 }
      );
    }

    // Sprawdź czy zaliczka została zapłacona, a reszta nie
    const firstPaymentStatus = booking.first_payment_status ?? "unpaid";
    const secondPaymentStatus = booking.second_payment_status ?? "unpaid";

    if (firstPaymentStatus !== "paid") {
      return NextResponse.json(
        { error: "first_payment_not_paid" },
        { status: 400 }
      );
    }

    if (secondPaymentStatus === "paid") {
      return NextResponse.json(
        { error: "payment_already_completed" },
        { status: 400 }
      );
    }

    if (!booking.contact_email) {
      return NextResponse.json(
        { error: "no_contact_email" },
        { status: 400 }
      );
    }

    // Pobierz liczbę uczestników
    const { data: participants } = await adminClient
      .from("participants")
      .select("id")
      .eq("booking_id", booking.id);

    const participantsCount = participants?.length ?? 1;
    const amountCents = booking.second_payment_amount_cents ?? 0;

    if (amountCents <= 0) {
      return NextResponse.json(
        { error: "invalid_amount" },
        { status: 400 }
      );
    }

    // Pobierz baseUrl
    const { origin } = new URL(request.url);
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl && process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    }
    if (!baseUrl) {
      baseUrl = origin;
    }

    // Wygeneruj link do płatności reszty
    // Używamy tego samego endpointu co dla zaliczki, ale PayNow automatycznie obliczy resztę
    const paymentLink = booking.access_token
      ? `${baseUrl}/booking/${booking.access_token}?payment=second`
      : `${baseUrl}/payments/paynow/init?booking_ref=${booking.booking_ref}&payment=second`;

    // Wygeneruj HTML maila
    const emailHtml = generatePaymentReminderEmail(
      booking.booking_ref,
      paymentLink,
      trip.title as string,
      trip.start_date,
      amountCents,
      participantsCount
    );

    // Wyślij mail
    const emailResponse = await fetch(`${baseUrl}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: booking.contact_email,
        subject: `Przypomnienie o płatności reszty kwoty - Rezerwacja ${booking.booking_ref}`,
        html: emailHtml,
        text: `Przypominamy o konieczności dokonania płatności reszty kwoty za rezerwację ${booking.booking_ref}.\n\nKwota do zapłacenia: ${(amountCents / 100).toFixed(2)} PLN\n\nLink do płatności: ${paymentLink}`,
      }),
    });

    if (!emailResponse.ok) {
      console.error("Failed to send payment reminder email");
      return NextResponse.json(
        { error: "email_send_failed" },
        { status: 500 }
      );
    }

    // Zaktualizuj reminder_sent_at
    await adminClient
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true, sent_at: new Date().toISOString() });
  } catch (error) {
    console.error("Error in POST /api/bookings/[id]/send-payment-reminder:", error);
    return NextResponse.json(
      { error: "unexpected_error" },
      { status: 500 }
    );
  }
}

