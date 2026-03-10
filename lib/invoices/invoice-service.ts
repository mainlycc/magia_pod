/**
 * Invoice Service - Centralny serwis fakturowania
 *
 * Orkiestruje cały flow:
 * 1. Sprawdź czy to pierwsza wpłata (advance) czy kolejna (advance_to_advance)
 * 2. Wyślij fakturę do Saldeo (invoice/add z PROFIT_MARGIN_TYPE)
 * 3. Odczekaj 30s na wygenerowanie PDF
 * 4. Pobierz PDF z Saldeo (invoice/listbyid)
 * 5. Zapisz PDF w Supabase Storage
 * 6. Zapisz rekord faktury w DB
 * 7. Wyślij email z fakturą do klienta
 */

import {
  createSaldeoInvoice,
  getInvoicePdfUrl,
  downloadPdf,
  type SaldeoConfig,
  type SaldeoInvoiceData,
} from "@/lib/saldeo/client";
import { createAdminClient } from "@/lib/supabase/admin";

// ===================== TYPES =====================

export interface ProcessPaymentInvoiceParams {
  bookingId: string;
  paymentHistoryId: string;
  amountCents: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  saldeoInvoiceId?: string;
  pdfStoragePath?: string;
  error?: string;
}

interface BookingData {
  id: string;
  booking_ref: string;
  trip_id: string;
  invoice_type: string | null;
  invoice_name: string | null;
  invoice_nip: string | null;
  invoice_address: { street?: string; city?: string; zip?: string } | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  address: { street?: string; city?: string; zip?: string } | null;
  company_name: string | null;
  company_nip: string | null;
  company_address: { street?: string; city?: string; zip?: string } | null;
  paid_amount_cents: number;
}

interface TripData {
  id: string;
  title: string;
  price_cents: number | null;
}

interface ParentInvoice {
  id: string;
  invoice_number: string;
  saldeo_invoice_id: string | null;
  invoice_type: string;
}

// ===================== CONFIG =====================

function getSaldeoConfig(): SaldeoConfig {
  return {
    username: process.env.SALDEO_USERNAME || "",
    apiToken: process.env.SALDEO_API_TOKEN || "",
    companyProgramId: process.env.SALDEO_COMPANY_PROGRAM_ID || "",
    apiUrl: process.env.SALDEO_API_URL || "https://saldeo-test.brainshare.pl",
  };
}

function validateSaldeoConfig(config: SaldeoConfig): boolean {
  return !!(config.username && config.apiToken && config.companyProgramId);
}

function getDefaultContractorId(): number | null {
  const raw = process.env.SALDEO_DEFAULT_CONTRACTOR_ID;
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// ===================== HELPERS =====================

/**
 * Prepare buyer data from booking based on invoice_type field.
 */
function prepareBuyerName(booking: BookingData): string {
  const invoiceType = booking.invoice_type || "contact";

  switch (invoiceType) {
    case "company":
      return booking.company_name || "";
    case "custom":
      return booking.invoice_name || "";
    case "contact":
    default: {
      const firstName = booking.contact_first_name || "";
      const lastName = booking.contact_last_name || "";
      return [firstName, lastName].filter(Boolean).join(" ").trim() || booking.contact_email || "";
    }
  }
}

/**
 * Delay helper - waits for specified milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===================== MAIN FLOW =====================

/**
 * Process a payment and create the appropriate invoice.
 *
 * Flow:
 * 1. Fetch booking, trip, participants data
 * 2. Check for existing invoices (to determine advance vs advance-to-advance)
 * 3. Create invoice in Saldeo with PROFIT_MARGIN_TYPE
 * 4. Wait 30s for PDF generation
 * 5. Fetch PDF URL, download, store in Supabase Storage
 * 6. Save invoice record in DB
 * 7. Send email with PDF to client
 */
export async function processPaymentInvoice(
  params: ProcessPaymentInvoiceParams
): Promise<InvoiceResult> {
  const { bookingId, paymentHistoryId, amountCents } = params;
  const supabase = createAdminClient();

  console.log("[InvoiceService] Starting invoice process:", {
    bookingId,
    paymentHistoryId,
    amountCents,
  });

  try {
    // ─── 1. Check if invoice already exists for this payment ───
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, saldeo_invoice_id")
      .eq("payment_history_id", paymentHistoryId)
      .maybeSingle();

    if (existingInvoice) {
      console.log("[InvoiceService] Invoice already exists for payment_history_id:", paymentHistoryId);
      return {
        success: true,
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        saldeoInvoiceId: existingInvoice.saldeo_invoice_id || undefined,
      };
    }

    // ─── 2. Fetch booking data ───
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_ref,
        trip_id,
        invoice_type,
        invoice_name,
        invoice_nip,
        invoice_address,
        contact_first_name,
        contact_last_name,
        contact_email,
        address,
        company_name,
        company_nip,
        company_address,
        paid_amount_cents
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("[InvoiceService] Booking not found:", bookingError);
      return { success: false, error: "Booking not found: " + bookingId };
    }

    // ─── 3. Fetch trip data ───
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, price_cents")
      .eq("id", booking.trip_id)
      .single();

    if (tripError || !trip) {
      console.error("[InvoiceService] Trip not found:", tripError);
      return { success: false, error: "Trip not found: " + booking.trip_id };
    }

    // ─── 4. Fetch participants count ───
    const { data: participants } = await supabase
      .from("participants")
      .select("id")
      .eq("booking_id", bookingId);

    const participantsCount = participants?.length || 1;

    // ─── 5. Determine invoice type: advance or advance_to_advance ───
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, saldeo_invoice_id, invoice_type")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    const hasExistingInvoices = existingInvoices && existingInvoices.length > 0;
    const invoiceType = hasExistingInvoices ? "advance_to_advance" : "advance";

    // Find the parent invoice (the last one in the chain)
    let parentInvoice: ParentInvoice | null = null;
    if (hasExistingInvoices) {
      parentInvoice = existingInvoices[existingInvoices.length - 1] as ParentInvoice;
    }

    console.log("[InvoiceService] Invoice type determination:", {
      invoiceType,
      existingInvoicesCount: existingInvoices?.length || 0,
      parentInvoiceId: parentInvoice?.id,
      parentInvoiceNumber: parentInvoice?.invoice_number,
    });

    // ─── 6. Prepare Saldeo config ───
    const saldeoConfig = getSaldeoConfig();
    if (!validateSaldeoConfig(saldeoConfig)) {
      console.error("[InvoiceService] Saldeo config missing");
      // Still save the invoice locally even without Saldeo
      return await saveInvoiceWithoutSaldeo(
        supabase,
        bookingId,
        paymentHistoryId,
        amountCents,
        invoiceType,
        parentInvoice?.id || null,
        "Brak konfiguracji Saldeo"
      );
    }

    // ─── 7. Build Saldeo invoice data ───
    const today = new Date().toISOString().split("T")[0];
    const totalOrderCents = (trip.price_cents || 0) * participantsCount;
    const paymentAmountZloty = amountCents / 100;
    const totalOrderZloty = totalOrderCents / 100;

    // Generate temporary number - Saldeo will assign the actual one
    const tempNumber = `FZal/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;

    const buyerName = prepareBuyerName(booking as BookingData);

    const invoiceDescription = invoiceType === "advance"
      ? `Faktura zaliczkowa - ${trip.title}`
      : `Faktura zaliczkowa do zaliczkowej - ${trip.title}`;

    const defaultContractorId = getDefaultContractorId();
    if (!defaultContractorId) {
      console.error("[InvoiceService] Missing SALDEO_DEFAULT_CONTRACTOR_ID env");
      return await saveInvoiceWithoutSaldeo(
        supabase,
        bookingId,
        paymentHistoryId,
        amountCents,
        invoiceType,
        parentInvoice?.id || null,
        "Brak domyślnego kontrahenta Saldeo (SALDEO_DEFAULT_CONTRACTOR_ID)"
      );
    }

    const saldeoData: SaldeoInvoiceData = {
      NUMBER: tempNumber,
      issueDate: today,
      saleDate: today,
      purchaserContractorId: defaultContractorId,
      currencyIso4217: "PLN",
      paymentType: "TRANSFER",
      calculatedFromGross: true,
      isAdvanceInvoice: true,
      profitMarginType: "TRAVEL_AGENCIES",
      orderSum: totalOrderZloty,
      paidSum: paymentAmountZloty,
      footer: invoiceType === "advance_to_advance" && parentInvoice
        ? `Faktura zaliczkowa do faktury ${parentInvoice.invoice_number}`
        : undefined,
      items: [
        {
          name: invoiceDescription,
          amount: participantsCount,
          unit: "szt.",
          unitValue: paymentAmountZloty / participantsCount,
          rate: "NP", // Nie podlega - procedura marży
        },
      ],
    };

    console.log("[InvoiceService] Sending invoice to Saldeo:", {
      invoiceType,
      profitMarginType: saldeoData.profitMarginType,
      orderSum: saldeoData.orderSum,
      paidSum: saldeoData.paidSum,
      buyerName,
    });

    // ─── 8. Create invoice in Saldeo ───
    const saldeoResponse = await createSaldeoInvoice(saldeoConfig, saldeoData);

    console.log("[InvoiceService] Saldeo response:", {
      success: saldeoResponse.success,
      invoiceId: saldeoResponse.invoiceId,
      error: saldeoResponse.error,
      rawResponsePreview: saldeoResponse.rawResponse?.substring(0, 300),
    });

    // ─── 9. Save invoice record (even if Saldeo failed) ───
    let saldeoError: string | null = null;
    if (!saldeoResponse.success) {
      saldeoError = saldeoResponse.error || "Unknown Saldeo error";
      if (saldeoResponse.rawResponse) {
        saldeoError += " | Raw: " + saldeoResponse.rawResponse.substring(0, 200);
      }
    }

    const { data: invoice, error: invoiceInsertError } = await supabase
      .from("invoices")
      .insert({
        booking_id: bookingId,
        payment_history_id: paymentHistoryId,
        invoice_number: null as any, // Trigger auto-generates
        amount_cents: amountCents,
        status: "wystawiona",
        invoice_type: invoiceType,
        parent_invoice_id: parentInvoice?.id || null,
        saldeo_invoice_id: saldeoResponse.invoiceId || null,
        saldeo_error: saldeoError,
      })
      .select()
      .single();

    if (invoiceInsertError) {
      console.error("[InvoiceService] Failed to insert invoice:", invoiceInsertError);
      return {
        success: false,
        error: "Failed to save invoice: " + invoiceInsertError.message,
      };
    }

    console.log("[InvoiceService] Invoice saved:", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceType,
      saldeoInvoiceId: saldeoResponse.invoiceId,
    });

    // ─── 10. If Saldeo succeeded, fetch PDF after 30s delay ───
    if (saldeoResponse.success && saldeoResponse.invoiceId) {
      // Run PDF fetching and email sending asynchronously (don't block the response)
      fetchPdfAndSendEmail(
        saldeoConfig,
        supabase,
        invoice.id,
        saldeoResponse.invoiceId,
        booking as BookingData,
        invoice.invoice_number,
        invoiceType === "advance" || invoiceType === "advance_to_advance"
      ).catch((err) => {
        console.error("[InvoiceService] Background PDF/email task failed:", err);
      });
    }

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      saldeoInvoiceId: saldeoResponse.invoiceId || undefined,
    };
  } catch (error) {
    console.error("[InvoiceService] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ===================== BACKGROUND TASKS =====================

/**
 * Fetches PDF from Saldeo (after 30s delay), stores it in Supabase Storage,
 * updates the invoice record, and sends the PDF to the client via email.
 */
async function fetchPdfAndSendEmail(
  saldeoConfig: SaldeoConfig,
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  saldeoInvoiceId: string,
  booking: BookingData,
  invoiceNumber: string,
  isAdvanceInvoice: boolean
): Promise<void> {
  console.log("[InvoiceService] Waiting 30s for Saldeo PDF generation...");
  await delay(30_000);

  // ─── Fetch PDF URL from Saldeo ───
  console.log("[InvoiceService] Fetching PDF URL from Saldeo for invoice:", saldeoInvoiceId);
  const pdfResponse = await getInvoicePdfUrl(saldeoConfig, saldeoInvoiceId, isAdvanceInvoice);

  if (!pdfResponse.success || !pdfResponse.pdfUrl) {
    console.error("[InvoiceService] Failed to get PDF URL:", pdfResponse.error);

    // If advance invoice container didn't work, try regular invoice container
    if (isAdvanceInvoice) {
      console.log("[InvoiceService] Retrying with regular invoice container...");
      const retryResponse = await getInvoicePdfUrl(saldeoConfig, saldeoInvoiceId, false);
      if (retryResponse.success && retryResponse.pdfUrl) {
        console.log("[InvoiceService] Retry succeeded with regular invoice container");
        await processPdfAndEmail(supabase, invoiceId, retryResponse.pdfUrl, booking, invoiceNumber);
        return;
      }
    }

    // Update invoice with error
    await supabase
      .from("invoices")
      .update({
        saldeo_error: (await supabase
          .from("invoices")
          .select("saldeo_error")
          .eq("id", invoiceId)
          .single()
          .then(r => r.data?.saldeo_error || "")) +
          " | PDF fetch failed: " + (pdfResponse.error || "unknown"),
      })
      .eq("id", invoiceId);
    return;
  }

  await processPdfAndEmail(supabase, invoiceId, pdfResponse.pdfUrl, booking, invoiceNumber);
}

/**
 * Downloads PDF, stores in Supabase Storage, updates invoice, sends email.
 */
async function processPdfAndEmail(
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  pdfUrl: string,
  booking: BookingData,
  invoiceNumber: string
): Promise<void> {
  // ─── Download PDF ───
  console.log("[InvoiceService] Downloading PDF from:", pdfUrl);
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await downloadPdf(pdfUrl);
    console.log("[InvoiceService] PDF downloaded, size:", pdfBuffer.length, "bytes");
  } catch (err) {
    console.error("[InvoiceService] Failed to download PDF:", err);
    return;
  }

  // ─── Store in Supabase Storage ───
  const safeInvoiceNumber = invoiceNumber.replace(/\//g, "-");
  const storagePath = `${booking.booking_ref}/${safeInvoiceNumber}.pdf`;

  console.log("[InvoiceService] Uploading PDF to storage:", storagePath);
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[InvoiceService] Failed to upload PDF to storage:", uploadError);
    // Still update the invoice with pdf_url from Saldeo
    await supabase
      .from("invoices")
      .update({ pdf_url: pdfUrl })
      .eq("id", invoiceId);
  } else {
    // Update invoice with both storage path and original URL
    await supabase
      .from("invoices")
      .update({
        pdf_url: pdfUrl,
        pdf_storage_path: storagePath,
      })
      .eq("id", invoiceId);
    console.log("[InvoiceService] PDF stored successfully at:", storagePath);
  }

  // ─── Send email to client ───
  if (booking.contact_email) {
    console.log("[InvoiceService] Sending invoice email to:", booking.contact_email);

    try {
      const pdfBase64 = pdfBuffer.toString("base64");

      // Use the /api/email endpoint for sending
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      const emailResponse = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: booking.contact_email,
          subject: `Faktura zaliczkowa ${invoiceNumber} - Magia Podróżowania`,
          html: buildInvoiceEmailHtml(invoiceNumber, booking.booking_ref),
          text: `W załączniku przesyłamy fakturę zaliczkową ${invoiceNumber} dla rezerwacji ${booking.booking_ref}.\n\nDziękujemy za wpłatę!\n\nMagia Podróżowania`,
          attachment: {
            filename: `${safeInvoiceNumber}.pdf`,
            base64: pdfBase64,
          },
        }),
      });

      if (emailResponse.ok) {
        console.log("[InvoiceService] ✓ Invoice email sent successfully to:", booking.contact_email);
        // Update invoice status to 'wysłana'
        await supabase
          .from("invoices")
          .update({ status: "wysłana" })
          .eq("id", invoiceId);
      } else {
        const errorData = await emailResponse.json().catch(() => ({ error: "Unknown" }));
        console.error("[InvoiceService] Failed to send invoice email:", errorData);
      }
    } catch (emailErr) {
      console.error("[InvoiceService] Error sending invoice email:", emailErr);
    }
  } else {
    console.log("[InvoiceService] No contact email for booking:", booking.id);
  }
}

// ===================== FALLBACK =====================

/**
 * Saves invoice locally when Saldeo config is missing.
 */
async function saveInvoiceWithoutSaldeo(
  supabase: ReturnType<typeof createAdminClient>,
  bookingId: string,
  paymentHistoryId: string,
  amountCents: number,
  invoiceType: string,
  parentInvoiceId: string | null,
  errorMessage: string
): Promise<InvoiceResult> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      booking_id: bookingId,
      payment_history_id: paymentHistoryId,
      invoice_number: null as any,
      amount_cents: amountCents,
      status: "wystawiona",
      invoice_type: invoiceType,
      parent_invoice_id: parentInvoiceId,
      saldeo_error: errorMessage,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: "Failed to save invoice: " + error.message };
  }

  return {
    success: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
  };
}

// ===================== EMAIL TEMPLATE =====================

function buildInvoiceEmailHtml(invoiceNumber: string, bookingRef: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Faktura zaliczkowa - Magia Podróżowania</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                    Magia Podróżowania
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #1d4ed8; font-size: 24px; font-weight: 600;">
                    Faktura zaliczkowa
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                    W załączniku przesyłamy fakturę zaliczkową <strong>${invoiceNumber}</strong> 
                    dla rezerwacji <strong>${bookingRef}</strong>.
                  </p>
                  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af; font-weight: 600;">
                      📄 Faktura w załączniku
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
                      Faktura zaliczkowa została dołączona do tego emaila w formacie PDF. 
                      Prosimy o zachowanie jej do celów rozliczeniowych.
                    </p>
                  </div>
                  <p style="margin: 20px 0 0 0; font-size: 14px; color: #666666; line-height: 1.5;">
                    Dziękujemy za wpłatę i życzymy udanej podróży!
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                    Magia Podróżowania &copy; ${new Date().getFullYear()}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
