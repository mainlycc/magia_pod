/**
 * Invoice Service - Centralny serwis fakturowania
 *
 * Logika wystawiania faktur (procedura marży biur podróży):
 *
 * Pierwsza płatność:
 *   1. Utwórz zamówienie (order) w Fakturownia – podstawa dla KSeF
 *   2. Zapisz order_id w bookings.fakturownia_order_id
 *   3. Wystaw fakturę zaliczkową (kind: "advance") powiązaną z zamówieniem
 *
 * Kolejne płatności:
 *   1. Pobierz istniejące order_id z bookings.fakturownia_order_id
 *   2. Pobierz fakturownia_invoice_id poprzedniej faktury
 *   3. Wystaw fakturę zaliczkową do zaliczkowej (kind: "advance", from_invoice_id)
 *
 * Po wystawieniu faktury (obie ścieżki):
 *   - Pobierz PDF z Fakturownia (10s delay)
 *   - Zapisz PDF w Supabase Storage
 *   - Wyślij PDF emailem do klienta
 */

import {
  createOrder,
  createInvoice,
  buildInvoicePdfUrl,
  downloadPdf,
  type FakturowniaConfig,
  type FakturowniaInvoiceData,
} from "@/lib/fakturownia/client";
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
  providerInvoiceId?: string;
  pdfStoragePath?: string;
  error?: string;
}

interface BookingData {
  id: string;
  booking_ref: string;
  trip_id: string;
  fakturownia_order_id: string | null;
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
  fakturownia_invoice_id: string | null;
  invoice_type: string;
}

// ===================== CONFIG =====================

function getFakturowniaConfig(): FakturowniaConfig {
  return {
    apiToken: process.env.FAKTUROWNIA_API_TOKEN || "",
    subdomain: process.env.FAKTUROWNIA_SUBDOMAIN || "",
  };
}

function validateFakturowniaConfig(config: FakturowniaConfig): boolean {
  return !!(config.apiToken && config.subdomain);
}

// ===================== HELPERS =====================

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

function prepareBuyerNip(booking: BookingData): string | undefined {
  const invoiceType = booking.invoice_type || "contact";
  switch (invoiceType) {
    case "company":
      return booking.company_nip || undefined;
    case "custom":
      return booking.invoice_nip || undefined;
    default:
      return undefined;
  }
}

function prepareBuyerAddress(booking: BookingData): {
  street?: string;
  city?: string;
  post_code?: string;
} {
  const invoiceType = booking.invoice_type || "contact";
  let addr: { street?: string; city?: string; zip?: string } | null = null;
  switch (invoiceType) {
    case "company":
      addr = booking.company_address;
      break;
    case "custom":
      addr = booking.invoice_address;
      break;
    default:
      addr = booking.address;
  }
  if (!addr) return {};
  return {
    street: addr.street || undefined,
    city: addr.city || undefined,
    post_code: addr.zip || undefined,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===================== MAIN FLOW =====================

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
    // ─── 1. Sprawdź czy faktura dla tej wpłaty już istnieje ───
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, fakturownia_invoice_id")
      .eq("payment_history_id", paymentHistoryId)
      .maybeSingle();

    if (existingInvoice) {
      console.log("[InvoiceService] Invoice already exists for payment_history_id:", paymentHistoryId);
      return {
        success: true,
        invoiceId: existingInvoice.id,
        invoiceNumber: existingInvoice.invoice_number,
        providerInvoiceId: existingInvoice.fakturownia_invoice_id || undefined,
      };
    }

    // ─── 2. Pobierz dane rezerwacji ───
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_ref,
        trip_id,
        fakturownia_order_id,
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
      return { success: false, error: "Booking not found: " + bookingId };
    }

    // ─── 3. Pobierz dane wycieczki ───
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, price_cents")
      .eq("id", booking.trip_id)
      .single();

    if (tripError || !trip) {
      return { success: false, error: "Trip not found: " + booking.trip_id };
    }

    // ─── 4. Pobierz liczbę uczestników ───
    const { data: participants } = await supabase
      .from("participants")
      .select("id")
      .eq("booking_id", bookingId);
    const participantsCount = participants?.length || 1;

    // ─── 5. Pobierz poprzednie faktury dla tej rezerwacji ───
    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, fakturownia_invoice_id, invoice_type")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });

    const isFirstInvoice = !existingInvoices || existingInvoices.length === 0;
    const invoiceType = isFirstInvoice ? "advance" : "advance_to_advance";
    const parentInvoice: ParentInvoice | null = isFirstInvoice
      ? null
      : (existingInvoices![existingInvoices!.length - 1] as ParentInvoice);

    console.log("[InvoiceService] Invoice type determination:", {
      invoiceType,
      existingInvoicesCount: existingInvoices?.length || 0,
      parentInvoiceNumber: parentInvoice?.invoice_number,
    });

    // ─── 6. Sprawdź konfigurację Fakturownia ───
    const fakturowniaConfig = getFakturowniaConfig();
    if (!validateFakturowniaConfig(fakturowniaConfig)) {
      console.error("[InvoiceService] Fakturownia config missing");
      return await saveInvoiceWithoutProvider(
        supabase,
        bookingId,
        paymentHistoryId,
        amountCents,
        invoiceType,
        parentInvoice?.id || null,
        "Brak konfiguracji Fakturownia (FAKTUROWNIA_API_TOKEN, FAKTUROWNIA_SUBDOMAIN)"
      );
    }

    // ─── 7. Przygotuj dane nabywcy ───
    const buyerName = prepareBuyerName(booking as BookingData);
    const buyerNip = prepareBuyerNip(booking as BookingData);
    const buyerAddress = prepareBuyerAddress(booking as BookingData);
    const today = new Date().toISOString().split("T")[0];

    const paymentAmountZloty = amountCents / 100;
    const priceNetPerPerson = paymentAmountZloty / participantsCount;
    const totalPriceCents = (trip.price_cents || 0) * participantsCount;
    const totalPriceZloty = totalPriceCents / 100;

    // ─── 8. Utwórz lub pobierz zamówienie Fakturownia ───
    let fakturowniaOrderId: number | undefined;

    if (isFirstInvoice) {
      // Pierwsza faktura – utwórz zamówienie reprezentujące pełny koszt rezerwacji
      console.log("[InvoiceService] Creating Fakturownia order for booking:", bookingId);

      const orderResponse = await createOrder(fakturowniaConfig, {
        buyer_name: buyerName,
        buyer_tax_no: buyerNip,
        buyer_street: buyerAddress.street,
        buyer_city: buyerAddress.city,
        buyer_post_code: buyerAddress.post_code,
        buyer_email: booking.contact_email || undefined,
        currency: "PLN",
        lang: "pl",
        description: `Zamówienie – ${trip.title} (${booking.booking_ref})`,
        positions: [
          {
            name: trip.title,
            quantity: participantsCount,
            price_net: totalPriceZloty / participantsCount,
            total_price_gross: totalPriceZloty,
            tax: "np",
          },
        ],
      });

      if (!orderResponse.success || !orderResponse.orderId) {
        console.error("[InvoiceService] Failed to create order:", orderResponse.error);
        return await saveInvoiceWithoutProvider(
          supabase,
          bookingId,
          paymentHistoryId,
          amountCents,
          invoiceType,
          null,
          `Błąd tworzenia zamówienia Fakturownia: ${orderResponse.error}`
        );
      }

      fakturowniaOrderId = orderResponse.orderId;

      // Zapisz order_id w rezerwacji
      await supabase
        .from("bookings")
        .update({ fakturownia_order_id: String(fakturowniaOrderId) })
        .eq("id", bookingId);

      console.log("[InvoiceService] Order created and saved:", fakturowniaOrderId);
    } else {
      // Kolejna faktura – użyj istniejącego zamówienia
      const existingOrderId = (booking as BookingData).fakturownia_order_id;
      if (existingOrderId) {
        fakturowniaOrderId = parseInt(existingOrderId, 10);
        console.log("[InvoiceService] Using existing order_id:", fakturowniaOrderId);
      } else {
        // Zamówienie nie zostało zapisane (np. błąd wcześniej) – kontynuuj bez niego
        console.warn("[InvoiceService] No order_id found for booking, proceeding without it");
      }
    }

    // ─── 9. Zbuduj dane faktury ───
    const invoiceDescription =
      invoiceType === "advance"
        ? `Faktura zaliczkowa – ${trip.title}`
        : `Faktura zaliczkowa do zaliczkowej – ${trip.title}`;

    const invoiceData: FakturowniaInvoiceData = {
      kind: "advance",
      issue_date: today,
      sell_date: today,
      payment_type: "transfer",
      currency: "PLN",
      lang: "pl",
      buyer_name: buyerName,
      buyer_tax_no: buyerNip,
      buyer_street: buyerAddress.street,
      buyer_city: buyerAddress.city,
      buyer_post_code: buyerAddress.post_code,
      buyer_email: booking.contact_email || undefined,
      order_id: fakturowniaOrderId,
      from_invoice_id:
        parentInvoice?.fakturownia_invoice_id
          ? parseInt(parentInvoice.fakturownia_invoice_id, 10)
          : undefined,
      positions: [
        {
          name: invoiceDescription,
          quantity: participantsCount,
          price_net: priceNetPerPerson,
          total_price_gross: paymentAmountZloty,
          tax: "np",
        },
      ],
      internal_note:
        invoiceType === "advance_to_advance" && parentInvoice
          ? `Faktura zaliczkowa do faktury ${parentInvoice.invoice_number}`
          : undefined,
    };

    console.log("[InvoiceService] Sending invoice to Fakturownia:", {
      kind: invoiceData.kind,
      invoiceType,
      buyerName,
      orderId: fakturowniaOrderId,
      fromInvoiceId: invoiceData.from_invoice_id,
    });

    // ─── 10. Wystaw fakturę w Fakturownia ───
    const fakturowniaResponse = await createInvoice(fakturowniaConfig, invoiceData);

    console.log("[InvoiceService] Fakturownia response:", {
      success: fakturowniaResponse.success,
      invoiceId: fakturowniaResponse.invoiceId,
      invoiceNumber: fakturowniaResponse.invoiceNumber,
      error: fakturowniaResponse.error,
    });

    const providerError = fakturowniaResponse.success
      ? null
      : (fakturowniaResponse.error || "Unknown Fakturownia error");

    // ─── 11. Zapisz rekord faktury w DB ───
    const { data: invoice, error: invoiceInsertError } = await supabase
      .from("invoices")
      .insert({
        booking_id: bookingId,
        payment_history_id: paymentHistoryId,
        invoice_number: null as any, // trigger auto-generuje numer
        amount_cents: amountCents,
        status: "wystawiona",
        invoice_type: invoiceType,
        parent_invoice_id: parentInvoice?.id || null,
        fakturownia_invoice_id: fakturowniaResponse.invoiceId?.toString() || null,
        invoice_provider_error: providerError,
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
      fakturowniaInvoiceId: fakturowniaResponse.invoiceId,
    });

    // ─── 12. Pobierz PDF i wyślij email (asynchronicznie) ───
    if (fakturowniaResponse.success && fakturowniaResponse.invoiceId) {
      fetchPdfAndSendEmail(
        fakturowniaConfig,
        supabase,
        invoice.id,
        fakturowniaResponse.invoiceId,
        fakturowniaResponse.pdfUrl,
        booking as BookingData,
        invoice.invoice_number
      ).catch((err) => {
        console.error("[InvoiceService] Background PDF/email task failed:", err);
      });
    }

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      providerInvoiceId: fakturowniaResponse.invoiceId?.toString() || undefined,
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

async function fetchPdfAndSendEmail(
  config: FakturowniaConfig,
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  fakturowniaInvoiceId: number,
  pdfUrlFromResponse: string | undefined,
  booking: BookingData,
  invoiceNumber: string
): Promise<void> {
  console.log("[InvoiceService] Waiting 10s for Fakturownia PDF generation...");
  await delay(10_000);

  const pdfUrl = pdfUrlFromResponse || buildInvoicePdfUrl(config, fakturowniaInvoiceId);
  await processPdfAndEmail(supabase, invoiceId, pdfUrl, booking, invoiceNumber);
}

async function processPdfAndEmail(
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  pdfUrl: string,
  booking: BookingData,
  invoiceNumber: string
): Promise<void> {
  console.log("[InvoiceService] Downloading PDF from Fakturownia:", pdfUrl);
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await downloadPdf(pdfUrl);
    console.log("[InvoiceService] PDF downloaded, size:", pdfBuffer.length, "bytes");
  } catch (err) {
    console.error("[InvoiceService] Failed to download PDF:", err);
    await supabase
      .from("invoices")
      .update({
        invoice_provider_error:
          "PDF download failed: " + (err instanceof Error ? err.message : String(err)),
      })
      .eq("id", invoiceId);
    return;
  }

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
    await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoiceId);
  } else {
    await supabase
      .from("invoices")
      .update({ pdf_url: pdfUrl, pdf_storage_path: storagePath })
      .eq("id", invoiceId);
    console.log("[InvoiceService] PDF stored successfully at:", storagePath);
  }

  if (booking.contact_email) {
    console.log("[InvoiceService] Sending invoice email to:", booking.contact_email);
    try {
      const pdfBase64 = pdfBuffer.toString("base64");
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      const emailResponse = await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: booking.contact_email,
          subject: `Faktura zaliczkowa ${invoiceNumber} – Magia Podróżowania`,
          html: buildInvoiceEmailHtml(invoiceNumber, booking.booking_ref),
          text: `W załączniku przesyłamy fakturę zaliczkową ${invoiceNumber} dla rezerwacji ${booking.booking_ref}.\n\nDziękujemy za wpłatę!\n\nMagia Podróżowania`,
          attachment: {
            filename: `${safeInvoiceNumber}.pdf`,
            base64: pdfBase64,
          },
        }),
      });

      if (emailResponse.ok) {
        console.log("[InvoiceService] Invoice email sent to:", booking.contact_email);
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
  }
}

// ===================== FALLBACK =====================

async function saveInvoiceWithoutProvider(
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
      invoice_provider_error: errorMessage,
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
      <title>Faktura zaliczkowa – Magia Podróżowania</title>
    </head>
    <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f5f5f5;padding:20px;">
        <tr>
          <td align="center" style="padding:20px 0;">
            <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background:linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%);padding:40px 30px;text-align:center;">
                  <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Magia Podróżowania</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 30px;">
                  <h2 style="margin:0 0 20px 0;color:#1d4ed8;font-size:24px;">Faktura zaliczkowa</h2>
                  <p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#333333;">
                    W załączniku przesyłamy fakturę zaliczkową <strong>${invoiceNumber}</strong>
                    dla rezerwacji <strong>${bookingRef}</strong>.
                  </p>
                  <div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:6px;margin:20px 0;">
                    <p style="margin:0 0 8px 0;font-size:14px;color:#1e40af;font-weight:600;">Faktura w załączniku</p>
                    <p style="margin:0;font-size:14px;color:#1e40af;line-height:1.5;">
                      Faktura zaliczkowa została dołączona do tego emaila w formacie PDF.
                      Prosimy o zachowanie jej do celów rozliczeniowych.
                    </p>
                  </div>
                  <p style="margin:20px 0 0 0;font-size:14px;color:#666666;line-height:1.5;">
                    Dziękujemy za wpłatę i życzymy udanej podróży!
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f8fafc;padding:20px 30px;text-align:center;border-top:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:12px;color:#94a3b8;">Magia Podróżowania &copy; ${new Date().getFullYear()}</p>
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
