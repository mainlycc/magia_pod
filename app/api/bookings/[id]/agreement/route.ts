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

    // Sprawdź czy są uczestnicy
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

    if (participants.length === 0) {
      return NextResponse.json({ error: "Brak uczestników w rezerwacji" }, { status: 400 });
    }

    // Sprawdź wymagane pola
    if (!booking.booking_ref) {
      return NextResponse.json({ error: "Brak numeru rezerwacji" }, { status: 400 });
    }

    if (!booking.contact_email) {
      return NextResponse.json({ error: "Brak adresu email klienta" }, { status: 400 });
    }

    if (!trip.title) {
      return NextResponse.json({ error: "Brak nazwy wycieczki" }, { status: 400 });
    }

    const tripInfo = {
      title: trip.title as string,
      start_date: trip.start_date ?? null,
      end_date: trip.end_date ?? null,
      price_cents: trip.price_cents ?? null,
    };

    // Pobierz reservation_number z wycieczki i policz numer kolejny umowy dla tej wycieczki
    const reservationNumber = (trip as any).reservation_number || null;
    let agreementNumber = 1; // Domyślnie pierwsza umowa
    
    if (reservationNumber && trip.id) {
      // Policz ile już jest umów dla wszystkich rezerwacji tej wycieczki
      const { data: tripBookings, error: bookingsError } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("trip_id", trip.id);
      
      if (!bookingsError && tripBookings && tripBookings.length > 0) {
        const bookingIds = tripBookings.map(b => b.id);
        const { count: agreementsCount, error: agreementsCountError } = await supabaseAdmin
          .from("agreements")
          .select("*", { count: "exact", head: true })
          .in("booking_id", bookingIds);
        
        if (!agreementsCountError && agreementsCount !== null) {
          agreementNumber = agreementsCount + 1;
        }
      }
    }

    // Przygotuj dane do generowania PDF
    const pdfPayload = {
      booking_ref: booking.booking_ref,
      reservation_number: reservationNumber,
      agreement_number: agreementNumber,
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
    };

    // Wywołaj endpoint PDF - użyj localhost dla środowiska deweloperskiego
    const { origin } = new URL(request.url);
    const baseUrl = 
      process.env.NEXT_PUBLIC_BASE_URL ?? 
      process.env.NEXT_PUBLIC_APP_URL ?? 
      (origin.includes('localhost') ? 'http://localhost:3000' : origin);

    let pdfRes: Response;
    try {
      pdfRes = await fetch(`${baseUrl}/api/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfPayload),
      });
    } catch (fetchError) {
      console.error("Failed to call PDF endpoint:", fetchError);
      return NextResponse.json({ 
        error: "Nie udało się wygenerować PDF", 
        details: fetchError instanceof Error ? fetchError.message : String(fetchError) 
      }, { status: 500 });
    }

    // Odczytaj odpowiedź tylko raz
    const pdfResponseText = await pdfRes.text();
    
    if (!pdfRes.ok) {
      let errorData: any;
      try {
        if (pdfResponseText && pdfResponseText.trim()) {
          try {
            errorData = JSON.parse(pdfResponseText);
          } catch (parseError) {
            errorData = { error: "PDF generation failed", details: pdfResponseText.substring(0, 200) };
          }
        } else {
          errorData = { error: "PDF generation failed", details: `HTTP ${pdfRes.status}: ${pdfRes.statusText || "Empty response"}` };
        }
      } catch (textError) {
        errorData = { error: "PDF generation failed", details: `HTTP ${pdfRes.status}: ${pdfRes.statusText || "Failed to read response"}` };
      }
      console.error("PDF generation error:", { status: pdfRes.status, statusText: pdfRes.statusText, errorData, rawText: pdfResponseText.substring(0, 200) });
      return NextResponse.json({
        error: errorData.error || "PDF generation failed",
        details: errorData.details || errorData.message || errorData.error || `HTTP ${pdfRes.status}`,
      }, { status: pdfRes.status });
    }

    // Parsuj odpowiedź sukcesu
    let pdfResult: { base64: string; filename: string };
    try {
      if (!pdfResponseText || !pdfResponseText.trim()) {
        throw new Error("Empty response from PDF endpoint");
      }
      pdfResult = JSON.parse(pdfResponseText);
      if (!pdfResult.base64 || !pdfResult.filename) {
        throw new Error("Invalid response format from PDF endpoint");
      }
    } catch (parseError) {
      console.error("Failed to parse PDF response:", parseError);
      return NextResponse.json({
        error: "Failed to parse PDF response",
        details: parseError instanceof Error ? parseError.message : String(parseError)
      }, { status: 500 });
    }

    const { base64, filename } = pdfResult;

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
        return NextResponse.json({ 
          error: "Failed to update agreement",
          details: updateError.message || String(updateError)
        }, { status: 500 });
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
        return NextResponse.json({ 
          error: "Failed to create agreement record",
          details: insertError.message || String(insertError)
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Agreement generated successfully",
      filename,
    });
  } catch (error) {
    console.error("POST /api/bookings/[id]/agreement error", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error details:", { message: errorMessage, stack: errorStack });
    
    return NextResponse.json({ 
      error: "Unexpected error",
      details: errorMessage
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      }
    });
  }
}

