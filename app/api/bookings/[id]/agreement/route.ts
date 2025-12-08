import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    // Pobierz pełne dane rezerwacji
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
        *,
        trips:trips(*),
        participants:participants(*)
      `
      )
      .eq("id", id)
      .single();

    if (bookingError || !booking) {
      console.error("Failed to fetch booking", bookingError);
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const trip = Array.isArray(booking.trips) ? booking.trips[0] : booking.trips;
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Przygotuj dane do generowania PDF
    const { origin } = new URL(request.url);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? origin;

    const tripInfo = {
      title: trip.title as string,
      start_date: trip.start_date ?? null,
      end_date: trip.end_date ?? null,
      price_cents: trip.price_cents ?? null,
    };

    const participants = Array.isArray(booking.participants)
      ? booking.participants.map((p: any) => ({
          first_name: p.first_name,
          last_name: p.last_name,
          pesel: p.pesel,
          email: p.email || undefined,
          phone: p.phone || undefined,
          document_type: p.document_type || undefined,
          document_number: p.document_number || undefined,
        }))
      : [];

    // Wywołaj endpoint PDF
    const pdfRes = await fetch(`${baseUrl}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_ref: booking.booking_ref,
        trip: tripInfo,
        contact_email: booking.contact_email,
        contact_first_name: booking.contact_first_name || null,
        contact_last_name: booking.contact_last_name || null,
        contact_phone: booking.contact_phone || null,
        address: booking.address || null,
        company_name: booking.company_name || null,
        company_nip: booking.company_nip || null,
        company_address: booking.company_address || null,
        participants,
      }),
    });

    if (!pdfRes.ok) {
      const errorData = await pdfRes.json().catch(() => ({ error: "PDF generation failed" }));
      return NextResponse.json(errorData, { status: pdfRes.status });
    }

    const { base64, filename } = (await pdfRes.json()) as { base64: string; filename: string };

    // Zapisz informację o umowie w tabeli agreements
    const { data: existingAgreement, error: agreementCheckError } = await supabaseAdmin
      .from("agreements")
      .select("id")
      .eq("booking_id", id)
      .maybeSingle();

    if (agreementCheckError && agreementCheckError.code !== "PGRST116") {
      console.error("Error checking existing agreement:", agreementCheckError);
    }

    if (existingAgreement) {
      // Aktualizuj istniejący rekord
      const { error: updateError } = await supabaseAdmin
        .from("agreements")
        .update({
          status: "generated",
          pdf_url: filename,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAgreement.id);

      if (updateError) {
        console.error("Error updating agreement:", updateError);
        return NextResponse.json({ error: "Failed to update agreement" }, { status: 500 });
      }
    } else {
      // Utwórz nowy rekord
      const { error: insertError } = await supabaseAdmin.from("agreements").insert({
        booking_id: id,
        status: "generated",
        pdf_url: filename,
      });

      if (insertError) {
        console.error("Error creating agreement:", insertError);
        return NextResponse.json({ error: "Failed to create agreement record" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Agreement generated successfully",
      filename,
    });
  } catch (error) {
    console.error("POST /api/bookings/[id]/agreement error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

