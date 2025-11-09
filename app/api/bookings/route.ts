import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  rodo: z.literal(true, { errorMap: () => ({ message: "Wymagana zgoda RODO" }) }),
  terms: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj regulamin" }) }),
  conditions: z.literal(true, { errorMap: () => ({ message: "Zaakceptuj warunki udziału" }) }),
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
        "id, title, start_date, end_date, price_cents, seats_total, seats_reserved, is_active",
      )
      .eq("slug", payload.slug)
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
      })
      .select("id, booking_ref")
      .single();

    if (bookingErr || !booking) {
      await rollbackSeats();
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
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
        await fetch(`${baseUrl}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: payload.contact_email,
            subject: `Potwierdzenie rezerwacji ${booking.booking_ref}`,
            text: `Dziękujemy za rezerwację w Magii Podróżowania.\nKod rezerwacji: ${booking.booking_ref}`,
            attachment,
          }),
        });
      } catch {
        // ignorujemy błąd wysyłki maila, rezerwacja już zapisana
      }
    }

    return NextResponse.json(
      {
        booking_ref: booking.booking_ref,
        agreement_pdf_url: agreementPdfUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/bookings error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


