import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> | { token: string } }
) {
  try {
    const params = await (context.params instanceof Promise ? context.params : Promise.resolve(context.params));
    const { token } = params;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Walidacja formatu UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return NextResponse.json({ error: "Invalid token format" }, { status: 400 });
    }

    const supabase = await createClient();

    // Pobierz rezerwację po tokenie
    const { data: bookingData, error: bookingError } = await supabase.rpc("get_booking_by_token", {
      booking_token: token,
    });

    if (bookingError || !bookingData || bookingData.length === 0) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const booking = bookingData[0];

    // Pobierz plik z FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // Sprawdź czy to PDF
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    }

    // Sprawdź rozmiar pliku (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File size exceeds 10MB limit" }, { status: 400 });
    }

    // Konwertuj File na ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload do Supabase Storage
    const supabaseAdmin = createAdminClient();
    const signedFileName = `${booking.booking_ref}-signed-${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("agreements")
      .upload(signedFileName, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Zaktualizuj lub utwórz rekord w tabeli agreements
    const { data: existingAgreement } = await supabaseAdmin
      .from("agreements")
      .select("id")
      .eq("booking_id", booking.id)
      .single();

    if (existingAgreement) {
      // Aktualizuj istniejący rekord
      const { error: updateError } = await supabaseAdmin
        .from("agreements")
        .update({
          status: "signed",
          pdf_url: signedFileName,
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAgreement.id);

      if (updateError) {
        console.error("Error updating agreement:", updateError);
        // Usuń plik z storage jeśli nie udało się zaktualizować rekordu
        await supabaseAdmin.storage.from("agreements").remove([signedFileName]);
        return NextResponse.json({ error: "Failed to update agreement" }, { status: 500 });
      }
    } else {
      // Utwórz nowy rekord
      const { error: insertError } = await supabaseAdmin.from("agreements").insert({
        booking_id: booking.id,
        status: "signed",
        pdf_url: signedFileName,
        signed_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Error creating agreement:", insertError);
        // Usuń plik z storage jeśli nie udało się utworzyć rekordu
        await supabaseAdmin.storage.from("agreements").remove([signedFileName]);
        return NextResponse.json({ error: "Failed to create agreement record" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Agreement uploaded successfully",
      filename: signedFileName,
    });
  } catch (error) {
    console.error("POST /api/bookings/by-token/[token]/upload-agreement error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

