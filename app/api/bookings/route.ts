import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPaynowPayment } from "@/lib/paynow";
import { generateBookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";

const addressSchema = z.object({
  street: z.string().min(2, "Podaj ulicę"),
  city: z.string().min(2, "Podaj miasto"),
  zip: z.string().min(4, "Podaj kod pocztowy"),
});

const participantSchema = z.object({
  first_name: z.string().min(2, "Podaj imię"),
  last_name: z.string().min(2, "Podaj nazwisko"),
  pesel: z.string().regex(/^\d{11}$/, "PESEL musi mieć 11 cyfr"),
  email: z.string().email("Niepoprawny adres e-mail").optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().min(7, "Telefon jest zbyt krótki").optional().or(z.literal("").transform(() => undefined)),
  document_type: z.enum(["ID", "PASSPORT"]).optional(),
  document_number: z.string().min(3, "Podaj numer dokumentu").optional(),
});

const consentsSchema = z.object({
  rodo: z.literal(true),
  terms: z.literal(true),
  conditions: z.literal(true),
});

const bookingPayloadSchema = z.object({
  slug: z.string().min(1, "Brak identyfikatora wycieczki"),
  contact_email: z.string().email("Niepoprawny adres e-mail"),
  contact_phone: z.string().min(7, "Podaj numer telefonu"),
  address: addressSchema,
  participants: z.array(participantSchema).min(1, "Dodaj przynajmniej jednego uczestnika"),
  consents: consentsSchema,
});

type BookingPayload = z.infer<typeof bookingPayloadSchema>;

function generateRef() {
  return `BK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function buildConsents(consents: BookingPayload["consents"]) {
  const acceptedAt = new Date().toISOString();
  return Object.entries(consents).reduce<Record<string, { accepted: boolean; accepted_at: string }>>(
    (acc, [key, value]) => {
      acc[key] = { accepted: value, accepted_at: acceptedAt };
      return acc;
    },
    {},
  );
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = bookingPayloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const seatsRequested = payload.participants.length;

    const supabase = await createClient();

    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select(
        "id, title, start_date, end_date, price_cents, seats_total, seats_reserved, is_active, public_slug",
      )
      .or(`slug.eq.${payload.slug},public_slug.eq.${payload.slug}`)
      .eq("is_active", true)
      .single();

    if (tripErr || !trip) {
      return NextResponse.json({ error: "Trip not found or inactive" }, { status: 404 });
    }

    const seatsAvailable = Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0));
    if (seatsRequested > seatsAvailable) {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 });
    }

    const bookingRef = generateRef();

    const { data: reservedTrip, error: reserveErr } = await supabase.rpc("reserve_trip_seats", {
      p_trip_id: trip.id,
      p_requested: seatsRequested,
    });

    if (reserveErr || !reservedTrip) {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 });
    }

    const rollbackSeats = async () => {
      await supabase.rpc("release_trip_seats", {
        p_trip_id: trip.id,
        p_requested: seatsRequested,
      });
    };

    const consents = buildConsents(payload.consents);

    // Wstaw rezerwację (bez access_token w SELECT, żeby uniknąć problemów jeśli kolumna nie istnieje)
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .insert({
        trip_id: trip.id,
        booking_ref: bookingRef,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone,
        address: payload.address,
        consents,
        status: "confirmed",
        payment_status: "unpaid",
        source: "public_page",
      })
      .select("id, booking_ref")
      .single();

    if (bookingErr || !booking) {
      console.error("Error creating booking:", {
        error: bookingErr,
        message: bookingErr?.message,
        code: bookingErr?.code,
        details: bookingErr?.details,
        hint: bookingErr?.hint,
      });
      await rollbackSeats();
      return NextResponse.json(
        { 
          error: "Failed to create booking",
          details: bookingErr?.message || bookingErr?.hint || "Unknown error",
          code: bookingErr?.code,
        },
        { status: 500 }
      );
    }

    // Spróbuj pobrać access_token osobno (jeśli kolumna istnieje)
    let accessToken: string | null = null;
    try {
      const { data: bookingWithToken } = await supabase
        .from("bookings")
        .select("access_token")
        .eq("id", booking.id)
        .single();
      accessToken = bookingWithToken?.access_token || null;
    } catch (err) {
      // Ignoruj błąd - kolumna access_token może nie istnieć
      console.warn("Could not fetch access_token (column may not exist):", err);
    }

    const participantsPayload = payload.participants.map((participant) => ({
      booking_id: booking.id,
      first_name: participant.first_name.trim(),
      last_name: participant.last_name.trim(),
      pesel: participant.pesel,
      email: participant.email ?? null,
      phone: participant.phone ?? null,
      document_type: participant.document_type ?? null,
      document_number: participant.document_number ?? null,
      address: payload.address ?? null,
    }));

    const { error: participantsErr } = await supabase.from("participants").insert(participantsPayload);

    if (participantsErr) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      await rollbackSeats();
      return NextResponse.json({ error: "Failed to add participants" }, { status: 500 });
    }

    const { origin } = new URL(req.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? origin;

    const tripInfo = {
      title: trip.title as string,
      start_date: trip.start_date ?? null,
      end_date: trip.end_date ?? null,
      price_cents: trip.price_cents ?? null,
    };

    let attachment: { filename: string; base64: string } | null = null;
    let agreementPdfUrl: string | null = null;

    try {
      const pdfRes = await fetch(`${baseUrl}/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_ref: booking.booking_ref,
          trip: tripInfo,
          contact_email: payload.contact_email,
          participants: payload.participants.map((p) => ({
            first_name: p.first_name,
            last_name: p.last_name,
            pesel: p.pesel,
            email: p.email,
          })),
        }),
      });

      if (pdfRes.ok) {
        const { base64, filename } = (await pdfRes.json()) as { base64: string; filename: string };
        attachment = { filename, base64 };
        agreementPdfUrl = filename;
      }
    } catch {
      // intentionally swallow — brak PDF nie powinien blokować rezerwacji
    }

    if (payload.contact_email) {
      try {
        let emailHtml: string;
        let textContent: string;
        
        if (accessToken) {
          // Pełny email z linkiem do podstrony
          const bookingLink = `${baseUrl}/booking/${accessToken}`;
          emailHtml = generateBookingConfirmationEmail(
            booking.booking_ref,
            bookingLink,
            trip.title as string,
            trip.start_date,
            trip.end_date,
            seatsRequested,
          );
          textContent = `Dziękujemy za rezerwację w Magii Podróżowania.\nKod rezerwacji: ${booking.booking_ref}\n\nLink do przesłania umowy i płatności: ${bookingLink}`;
        } else {
          // Email bez linku (jeśli migracja nie została uruchomiona)
          emailHtml = generateBookingConfirmationEmail(
            booking.booking_ref,
            `${baseUrl}/trip/${trip.public_slug || payload.slug}`,
            trip.title as string,
            trip.start_date,
            trip.end_date,
            seatsRequested,
          );
          textContent = `Dziękujemy za rezerwację w Magii Podróżowania.\nKod rezerwacji: ${booking.booking_ref}`;
        }

        await fetch(`${baseUrl}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: payload.contact_email,
            subject: `Potwierdzenie rezerwacji ${booking.booking_ref}`,
            html: emailHtml,
            text: textContent,
            attachment,
          }),
        });
      } catch (err) {
        console.error("Error sending email:", err);
        // ignorujemy błąd wysyłki maila, rezerwacja już zapisana
      }
    }

    // Utworzenie płatności Paynow
    let redirectUrl: string | null = null;
    const unitPrice = trip.price_cents ?? 0;
    const totalAmountCents = unitPrice * seatsRequested;

    if (totalAmountCents > 0) {
      try {
        const payment = await createPaynowPayment({
          amountCents: totalAmountCents,
          externalId: booking.booking_ref,
          description: `Rezerwacja ${booking.booking_ref} - ${trip.title}`,
          continueUrl: `${baseUrl}/trip/${trip.public_slug || payload.slug}`,
          notificationUrl: `${baseUrl}/api/payments/paynow/webhook`,
        });
        redirectUrl = payment.redirectUrl ?? null;
      } catch (err) {
        // jeśli nie uda się stworzyć płatności, rezerwacja dalej istnieje,
        // ale użytkownik nie zostanie przekierowany do płatności online
        console.error("Paynow create payment error", err);
      }
    }

    return NextResponse.json(
      {
        booking_ref: booking.booking_ref,
        agreement_pdf_url: agreementPdfUrl,
        redirect_url: redirectUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/bookings error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


