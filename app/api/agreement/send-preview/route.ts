import { NextRequest, NextResponse } from "next/server";
import { templateToHtml, type AgreementTemplate } from "@/lib/agreement-template-parser";
import { replaceTripPlaceholders, replaceBookingPlaceholders } from "@/lib/agreement-placeholder-replacer";
import type { TripFullData, TripContentData } from "@/contexts/trip-context";

export const runtime = "nodejs";
export const maxDuration = 30;

type AgreementPreviewPayload = {
  template: AgreementTemplate;
  tripFullData: TripFullData | null;
  tripContentData: TripContentData | null;
  formData: {
    contact?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      pesel?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
    };
    company?: {
      name?: string;
      nip?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
    };
    participants?: Array<{
      first_name?: string;
      last_name?: string;
    }>;
    participant_services?: Array<{
      service_type?: string;
      service_title?: string;
    }>;
  };
  email: string;
  tripTitle?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AgreementPreviewPayload;

    if (!body.email || !body.template) {
      return NextResponse.json({ error: "Email and template are required" }, { status: 400 });
    }

    // Generuj HTML z szablonu
    const html = templateToHtml(body.template);
    
    // Zastąp placeholdery danymi z wycieczki
    let htmlWithData = replaceTripPlaceholders(html, body.tripFullData, body.tripContentData);
    
    // Zastąp placeholdery danymi z formularza
    htmlWithData = replaceBookingPlaceholders(
      htmlWithData,
      body.formData,
      body.tripFullData?.price_cents || null,
      body.tripFullData?.start_date || null
    );

    // Dodaj style CSS dla lepszego wyglądu PDF
    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Arial', sans-serif;
      line-height: 1.6;
      color: #1f2937;
      padding: 20px;
    }
    h1 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 24px;
      text-align: center;
      color: #111827;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 16px;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    td {
      padding: 12px;
      border: 1px solid #e5e7eb;
      vertical-align: top;
    }
    td:first-child {
      font-weight: 500;
      width: 40%;
      background-color: #f9fafb;
    }
    td:last-child {
      width: 60%;
    }
    p {
      margin: 16px 0;
      line-height: 1.6;
    }
    ul {
      margin: 16px 0;
      padding-left: 24px;
    }
    li {
      margin: 8px 0;
      line-height: 1.6;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  ${htmlWithData}
</body>
</html>`;

    // Generuj PDF z HTML - użyj bezpośredniego wywołania funkcji
    const pdfFilename = `umowa-${body.tripTitle ? body.tripTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase() : "preview"}.pdf`;
    
    console.log("Generating PDF from HTML, length:", styledHtml.length);
    
    // Określ baseUrl dla wysyłania emaila
    let baseUrl = "http://localhost:3000";
    if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXT_PUBLIC_BASE_URL) {
      baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    }
    
    // Importuj i wywołaj funkcję bezpośrednio zamiast używać fetch
    const { generatePdfFromHtml } = await import("@/lib/pdf-generator");
    
    let base64: string;
    let filename: string;
    
    try {
      const result = await generatePdfFromHtml(styledHtml, pdfFilename);
      base64 = result.base64;
      filename = result.filename;
      
      if (!base64) {
        throw new Error("PDF generation returned empty base64");
      }
      
      console.log("PDF generated successfully, size:", base64.length);
    } catch (pdfError) {
      console.error("PDF generation error:", pdfError);
      
      // Fallback: spróbuj użyć fetch tylko jeśli bezpośrednie wywołanie nie działa
      // Ale tylko w środowisku deweloperskim
      if (process.env.NODE_ENV === "development") {
        console.log("Trying fallback fetch to:", baseUrl);
        
        const pdfRes = await fetch(`${baseUrl}/api/pdf/from-html`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: styledHtml,
            filename: pdfFilename,
          }),
        });

        if (!pdfRes.ok) {
          const errorData = await pdfRes.json().catch(() => ({ error: "Unknown error" }));
          console.error("PDF generation failed:", {
            status: pdfRes.status,
            statusText: pdfRes.statusText,
            error: errorData,
          });
          throw new Error(errorData?.error || errorData?.details || `Failed to generate PDF: ${pdfRes.status} ${pdfRes.statusText}`);
        }

        const pdfData = await pdfRes.json() as { base64: string; filename: string };
        base64 = pdfData.base64;
        filename = pdfData.filename;
      } else {
        throw pdfError;
      }
    }

    // Wyślij email z PDF
    console.log("Sending email to:", body.email, "using baseUrl:", baseUrl);
    const emailRes = await fetch(`${baseUrl}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: body.email,
        subject: `Umowa - ${body.tripTitle || "Podgląd umowy"}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
            <h2>Umowa o udział w imprezie turystycznej</h2>
            <p>W załączniku znajdziesz wygenerowaną umowę w formacie PDF.</p>
            <p>Prosimy o sprawdzenie danych w umowie przed podpisaniem.</p>
            <p>Pozdrawiamy,<br/>Magia Podróży</p>
          </div>
        `,
        text: `W załączniku znajdziesz wygenerowaną umowę w formacie PDF.\n\nProsimy o sprawdzenie danych w umowie przed podpisaniem.\n\nPozdrawiamy,\nMagia Podróży`,
        attachment: {
          filename,
          base64,
        },
      }),
    });

    if (!emailRes.ok) {
      const errorData = await emailRes.json().catch(() => null);
      throw new Error(errorData?.error || "Failed to send email");
    }

    return NextResponse.json({ success: true, message: "Umowa została wysłana na email" });
  } catch (error) {
    console.error("Error sending agreement preview:", error);
    return NextResponse.json(
      {
        error: "Failed to send agreement",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
