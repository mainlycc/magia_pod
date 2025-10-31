import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateRef() {
  return `BK-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { slug, contact_email, contact_phone, address, participants, consents } = body ?? {};

    if (!slug || !contact_email || !Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = await createClient();

    // Find trip by slug
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, title, start_date, end_date, price_cents, seats_total, seats_reserved, is_active")
      .eq("slug", slug)
      .single();

    if (tripErr || !trip || trip.is_active !== true) {
      return NextResponse.json({ error: "Trip not found or inactive" }, { status: 404 });
    }

    const seatsLeft = Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0));
    if (participants.length > seatsLeft) {
      return NextResponse.json({ error: "Not enough seats" }, { status: 409 });
    }

    const booking_ref = generateRef();

    // Create booking
    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        trip_id: trip.id,
        booking_ref,
        contact_email,
        contact_phone,
        address,
        consents: consents ?? {},
        status: "confirmed",
      })
      .select("id, booking_ref")
      .single();

    if (bookErr || !booking) {
      return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
    }

    // Insert participants
    type ParticipantInput = {
      first_name: string;
      last_name: string;
      pesel: string;
      email?: string | null;
      phone?: string | null;
      document_type?: string | null;
      document_number?: string | null;
    };

    const participantsPayload = (participants as ParticipantInput[]).map((p) => ({
      booking_id: booking.id,
      first_name: p.first_name,
      last_name: p.last_name,
      pesel: p.pesel,
      email: p.email,
      phone: p.phone,
      document_type: p.document_type,
      document_number: p.document_number,
      address: address ?? null,
    }));

    const { error: partErr } = await supabase.from("participants").insert(participantsPayload);
    if (partErr) {
      return NextResponse.json({ error: "Failed to add participants" }, { status: 500 });
    }

    // Update seats_reserved
    await supabase
      .from("trips")
      .update({ seats_reserved: (trip.seats_reserved ?? 0) + participantsPayload.length })
      .eq("id", trip.id);

    // Generate PDF via internal API
    const tripInfo = {
      title: trip.title as string,
      start_date: trip.start_date ?? null,
      end_date: trip.end_date ?? null,
      price_cents: trip.price_cents ?? null,
    };

    const pdfRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_ref: booking.booking_ref,
        trip: tripInfo,
        contact_email,
        participants,
      }),
    });

    let attachment: { filename: string; base64: string } | null = null;
    if (pdfRes.ok) {
      const { base64, filename } = await pdfRes.json();
      attachment = { filename, base64 };
    }

    // Send email via internal API (if configured)
    if (contact_email) {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: contact_email,
          subject: `Potwierdzenie rezerwacji ${booking.booking_ref}`,
          text: `Dziękujemy za rezerwację. Kod: ${booking.booking_ref}`,
          attachment,
        }),
      });
    }

    return NextResponse.json({ booking_ref: booking.booking_ref }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}


