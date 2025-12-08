import { NextResponse } from "next/server";
import { generatePdf, type PdfPayload } from "../route";

// Konfiguracja runtime dla Vercel
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    // Przykładowe dane do wygenerowania umowy
    const exampleData: PdfPayload = {
      booking_ref: "PRZYKLAD-2025-001",
      trip: {
        title: "Przykładowa wycieczka",
        start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // za 30 dni
        end_date: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // za 37 dni
        price_cents: 100000, // 1000 PLN
      },
      contact_email: "przyklad@example.com",
      contact_first_name: "Jan",
      contact_last_name: "Kowalski",
      contact_phone: "+48 600 000 000",
      address: {
        street: "ul. Przykładowa 12/5",
        city: "Warszawa",
        zip: "00-001",
      },
      company_name: null,
      company_nip: null,
      company_address: null,
      participants: [
        {
          first_name: "Jan",
          last_name: "Kowalski",
          pesel: "88010112345",
          email: "jan@example.com",
          phone: "+48 600 000 000",
          document_type: "ID",
          document_number: "ABC123456",
        },
      ],
    };

    // Generowanie PDF
    const pdfBuffer = generatePdf(exampleData);

    // Zwróć PDF jako response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"przykladowa-umowa.pdf\"",
        "Cache-Control": "public, max-age=3600", // Cache na 1 godzinę
      },
    });
  } catch (error) {
    console.error("PDF preview generation error:", error);
    return NextResponse.json(
      {
        error: "PDF preview generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

