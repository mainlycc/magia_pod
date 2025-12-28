import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePaymentReminderEmail } from "@/lib/email/templates/payment-reminder";

/**
 * Cron job endpoint do automatycznego wysyłania przypomnień o płatności reszty kwoty
 * 
 * Wywoływany przez Vercel Cron Jobs (konfiguracja w vercel.json):
 * - Sprawdza wycieczki z payment_reminder_enabled = true
 * - Znajduje rezerwacje z zaliczką zapłaconą, ale resztą nie
 * - Wysyła maile z linkiem do płatności X dni przed wycieczką
 * 
 * Aby włączyć w Vercel, dodaj do vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/send-payment-reminders",
 *     "schedule": "0 9 * * *"  // Codziennie o 9:00 UTC
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  // Sprawdź czy to wywołanie z Vercel Cron (opcjonalna weryfikacja)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const adminClient = createAdminClient();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Pobierz wycieczki z włączonymi przypomnieniami
    const { data: trips, error: tripsError } = await adminClient
      .from("trips")
      .select(`
        id,
        title,
        start_date,
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
        { status: 500 }
      );
    }

    if (!trips || trips.length === 0) {
      return NextResponse.json({ 
        ok: true, 
        message: "No trips with reminders enabled",
        sent: 0 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalSent = 0;
    const errors: string[] = [];

    // Dla każdej wycieczki sprawdź rezerwacje
    for (const trip of trips) {
      const reminderDays = trip.payment_reminder_days_before ?? 7;
      const targetDate = new Date(trip.start_date);
      targetDate.setDate(targetDate.getDate() - reminderDays);
      targetDate.setHours(0, 0, 0, 0);

      // Sprawdź czy dzisiaj jest dzień wysyłki przypomnienia
      if (targetDate.getTime() !== today.getTime()) {
        continue; // Nie jest jeszcze czas na przypomnienie
      }

      // Pobierz rezerwacje dla tej wycieczki z:
      // - zaliczką zapłaconą (first_payment_status = 'paid')
      // - resztą nie zapłaconą (second_payment_status = 'unpaid')
      // - przypomnienie jeszcze nie wysłane (reminder_sent_at IS NULL)
      const { data: bookings, error: bookingsError } = await adminClient
        .from("bookings")
        .select(`
          id,
          booking_ref,
          contact_email,
          first_payment_status,
          second_payment_status,
          second_payment_amount_cents,
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
        continue; // Brak rezerwacji do przypomnienia
      }

      // Pobierz liczbę uczestników dla każdej rezerwacji
      for (const booking of bookings) {
        if (!booking.contact_email) {
          continue; // Brak emaila
        }

        const { data: participants } = await adminClient
          .from("participants")
          .select("id")
          .eq("booking_id", booking.id);

        const participantsCount = participants?.length ?? 1;
        const amountCents = booking.second_payment_amount_cents ?? 0;

        if (amountCents <= 0) {
          continue; // Nieprawidłowa kwota
        }

        // Wygeneruj link do płatności
        const paymentLink = booking.access_token
          ? `${baseUrl}/booking/${booking.access_token}?payment=second`
          : `${baseUrl}/payments/paynow/init?booking_ref=${booking.booking_ref}&payment=second`;

        // Wygeneruj HTML maila
        const emailHtml = generatePaymentReminderEmail(
          booking.booking_ref,
          paymentLink,
          trip.title,
          trip.start_date,
          amountCents,
          participantsCount
        );

        // Wyślij mail
        try {
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
            throw new Error(`Email send failed: ${emailResponse.status}`);
          }

          // Zaktualizuj reminder_sent_at
          await adminClient
            .from("bookings")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", booking.id);

          totalSent++;
          console.log(`Sent payment reminder for booking ${booking.booking_ref}`);
        } catch (error) {
          console.error(`Error sending reminder for booking ${booking.booking_ref}:`, error);
          errors.push(`Booking ${booking.booking_ref}: ${error instanceof Error ? error.message : String(error)}`);
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
      { status: 500 }
    );
  }
}

