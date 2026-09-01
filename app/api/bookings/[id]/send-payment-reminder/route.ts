import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderForBooking } from "@/lib/payments/send-payment-reminder-email";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

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

async function checkCoordinator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tripId: string,
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
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      const { data: bookingPreview } = await supabase
        .from("bookings")
        .select("trip_id")
        .eq("id", id)
        .single();

      if (!bookingPreview) {
        return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
      }

      const isCoordinator = await checkCoordinator(supabase, bookingPreview.trip_id);
      if (!isCoordinator) {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
    }

    const { data: booking, error: bookingError } = await adminClient
      .from("bookings")
      .select(`
        id,
        booking_ref,
        contact_email,
        contact_first_name,
        contact_last_name,
        trip_id,
        first_payment_status,
        second_payment_status,
        first_payment_amount_cents,
        second_payment_amount_cents,
        paid_amount_cents,
        reminder_sent_at,
        access_token,
        trips:trips!inner(
          id,
          title,
          start_date,
          end_date,
          location,
          payment_split_enabled
        )
      `)
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }

    const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;

    if (!(trip?.payment_split_enabled ?? true)) {
      return NextResponse.json({ error: "payment_split_not_enabled" }, { status: 400 });
    }

    if ((booking.first_payment_status ?? "unpaid") !== "paid") {
      return NextResponse.json({ error: "first_payment_not_paid" }, { status: 400 });
    }

    if (booking.second_payment_status === "paid") {
      return NextResponse.json({ error: "payment_already_completed" }, { status: 400 });
    }

    if (!booking.contact_email) {
      return NextResponse.json({ error: "no_contact_email" }, { status: 400 });
    }

    const amountCents = booking.second_payment_amount_cents ?? 0;
    if (amountCents <= 0) {
      return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
    }

    const { data: participants } = await adminClient
      .from("participants")
      .select("first_name, last_name")
      .eq("booking_id", booking.id);

    const { origin } = new URL(request.url);
    const baseUrl = resolvePublicBaseUrl(origin);

    const sendResult = await sendPaymentReminderForBooking({
      adminClient,
      booking,
      trip: {
        title: trip.title as string,
        start_date: trip.start_date,
        end_date: trip.end_date,
        location: trip.location,
      },
      baseUrl,
      participants: participants ?? [],
    });

    if (!sendResult.ok) {
      console.error("Failed to send payment reminder email:", sendResult.error);
      return NextResponse.json({ error: "email_send_failed" }, { status: 500 });
    }

    await adminClient
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ ok: true, sent_at: new Date().toISOString() });
  } catch (error) {
    console.error("Error in POST /api/bookings/[id]/send-payment-reminder:", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
