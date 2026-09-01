import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPaymentReminderForBooking } from "@/lib/payments/send-payment-reminder-email";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

/**
 * Cron: automatyczne przypomnienia o dopłacie (druga rata) X dni przed wyjazdem.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const baseUrl = resolvePublicBaseUrl(process.env.NEXT_PUBLIC_BASE_URL ?? request.url);

    const { data: trips, error: tripsError } = await adminClient
      .from("trips")
      .select(`
        id,
        title,
        start_date,
        end_date,
        location,
        payment_reminder_enabled,
        payment_reminder_days_before
      `)
      .eq("payment_reminder_enabled", true)
      .not("payment_reminder_days_before", "is", null)
      .not("start_date", "is", null);

    if (tripsError) {
      console.error("Error fetching trips:", tripsError);
      return NextResponse.json(
        { error: "failed_to_fetch_trips", details: tripsError.message },
        { status: 500 },
      );
    }

    if (!trips || trips.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No trips with reminders enabled",
        sent: 0,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSent = 0;
    const errors: string[] = [];

    for (const trip of trips) {
      const reminderDays = trip.payment_reminder_days_before ?? 7;
      const targetDate = new Date(trip.start_date);
      targetDate.setDate(targetDate.getDate() - reminderDays);
      targetDate.setHours(0, 0, 0, 0);

      if (targetDate.getTime() !== today.getTime()) {
        continue;
      }

      const { data: bookings, error: bookingsError } = await adminClient
        .from("bookings")
        .select(`
          id,
          booking_ref,
          contact_email,
          contact_first_name,
          contact_last_name,
          first_payment_status,
          second_payment_status,
          first_payment_amount_cents,
          second_payment_amount_cents,
          paid_amount_cents,
          reminder_sent_at,
          access_token
        `)
        .eq("trip_id", trip.id)
        .eq("first_payment_status", "paid")
        .eq("second_payment_status", "unpaid")
        .is("reminder_sent_at", null);

      if (bookingsError) {
        console.error(`Error fetching bookings for trip ${trip.id}:`, bookingsError);
        errors.push(`Trip ${trip.id}: ${bookingsError.message}`);
        continue;
      }

      if (!bookings || bookings.length === 0) {
        continue;
      }

      for (const booking of bookings) {
        if (!booking.contact_email) continue;

        const amountCents = booking.second_payment_amount_cents ?? 0;
        if (amountCents <= 0) continue;

        const { data: participants } = await adminClient
          .from("participants")
          .select("first_name, last_name")
          .eq("booking_id", booking.id);

        try {
          const sendResult = await sendPaymentReminderForBooking({
            adminClient,
            booking,
            trip: {
              title: trip.title,
              start_date: trip.start_date,
              end_date: trip.end_date,
              location: trip.location,
            },
            baseUrl,
            participants: participants ?? [],
          });

          if (!sendResult.ok) {
            throw new Error(sendResult.error ?? "email_send_failed");
          }

          await adminClient
            .from("bookings")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", booking.id);

          totalSent++;
          console.log(`Sent payment reminder for booking ${booking.id}`);
        } catch (error) {
          console.error(`Error sending reminder for booking ${booking.id}:`, error);
          errors.push(
            `Booking ${booking.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sent: totalSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in cron job send-payment-reminders:", error);
    return NextResponse.json(
      { error: "unexpected_error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
