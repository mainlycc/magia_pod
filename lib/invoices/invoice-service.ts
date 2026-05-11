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
 *   - Pobierz PDF z Fakturownia (krótki delay + ponawianie / odświeżanie pdf_url)
 *   - Zapisz PDF w Supabase Storage
 *   - Wyślij PDF emailem do klienta (Resend bez wewnętrznego HTTP)
 */

import {
  buildFakturowniaConfigFromEnv,
  createOrder,
  createInvoice,
  buildInvoicePdfUrl,
  downloadPdf,
  extractOrderIdFromInvoiceJson,
  getInvoice,
  type FakturowniaConfig,
  type FakturowniaInvoiceData,
} from "@/lib/fakturownia/client";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import { createAdminClient } from "@/lib/supabase/admin";

// ===================== TYPES =====================

export interface ProcessPaymentInvoiceParams {
  bookingId: string;
  paymentHistoryId: string;
  amountCents: number;
  /**
   * Na Vercel: przekaż `(p) => waitUntil(p)` z `@vercel/functions`, żeby dokończyć pobranie PDF i e-mail po zwrocie odpowiedzi.
   */
  scheduleAfterResponse?: (task: Promise<void>) => void;
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
  return buildFakturowniaConfigFromEnv();
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

interface InvoiceRowLite {
  id: string;
  invoice_number: string;
  fakturownia_invoice_id: string | null;
  invoice_type: string;
}

/**
 * Gdy w bazie jest już faktura, ale bookings.fakturownia_order_id jest puste:
 * 1) Odczytaj oid z istniejącej faktury w Fakturowni (GET).
 * 2) Jeśli się nie da — utwórz zamówienie (estimate) jak przy pierwszej wpłacie i zapisz w booking.
 */
async function recoverMissingFakturowniaOrderId(
  supabase: ReturnType<typeof createAdminClient>,
  config: FakturowniaConfig,
  bookingId: string,
  booking: BookingData,
  trip: TripData,
  participantsCount: number,
  existingInvoices: InvoiceRowLite[]
): Promise<{ orderId: number } | { error: string }> {
  for (let i = existingInvoices.length - 1; i >= 0; i--) {
    const row = existingInvoices[i];
    if (!row.fakturownia_invoice_id) continue;

    const details = await getInvoice(config, row.fakturownia_invoice_id);
    if (!details.success || !details.rawResponse) continue;

    const oid = extractOrderIdFromInvoiceJson(details.rawResponse as Record<string, unknown>);
    if (oid) {
      await supabase
        .from("bookings")
        .update({ fakturownia_order_id: String(oid) })
        .eq("id", bookingId);
      console.log("[InvoiceService] Recovered fakturownia_order_id from invoice API:", oid);
      return { orderId: oid };
    }
  }

  console.log(
    "[InvoiceService] Could not read oid from existing Fakturownia invoices; creating order (recovery)"
  );

  const buyerName = prepareBuyerName(booking);
  const buyerNip = prepareBuyerNip(booking);
  const buyerAddress = prepareBuyerAddress(booking);
  const totalPriceCents = (trip.price_cents || 0) * participantsCount;
  const totalPriceZloty = totalPriceCents / 100;

  const orderResponse = await createOrder(config, {
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
    return {
      error: `Odzysk zamówienia KSeF nie powiódł się (tworzenie zamówienia): ${orderResponse.error || "unknown"}`,
    };
  }

  await supabase
    .from("bookings")
    .update({ fakturownia_order_id: String(orderResponse.orderId) })
    .eq("id", bookingId);

  console.log("[InvoiceService] Recovery: created Fakturownia order:", orderResponse.orderId);
  return { orderId: orderResponse.orderId };
}

// ===================== MAIN FLOW =====================

export async function processPaymentInvoice(
  params: ProcessPaymentInvoiceParams
): Promise<InvoiceResult> {
  const { bookingId, paymentHistoryId, amountCents, scheduleAfterResponse } = params;
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
      // Kolejna faktura – użyj istniejącego zamówienia lub odzyskaj oid (lokalny rekord bez order_id)
      const existingOrderId = (booking as BookingData).fakturownia_order_id;
      if (existingOrderId) {
        fakturowniaOrderId = parseInt(existingOrderId, 10);
        console.log("[InvoiceService] Using existing order_id:", fakturowniaOrderId);
      } else {
        console.warn(
          "[InvoiceService] No order_id on booking — attempting recovery from Fakturownia / new order"
        );
        const recovered = await recoverMissingFakturowniaOrderId(
          supabase,
          fakturowniaConfig,
          bookingId,
          booking as BookingData,
          trip,
          participantsCount,
          (existingInvoices || []) as InvoiceRowLite[]
        );
        if ("error" in recovered) {
          return await saveInvoiceWithoutProvider(
            supabase,
            bookingId,
            paymentHistoryId,
            amountCents,
            invoiceType,
            parentInvoice?.id || null,
            recovered.error
          );
        }
        fakturowniaOrderId = recovered.orderId;
      }
    }

    // KSeF: faktura zaliczkowa nie może być wystawiona bez powiązania do 1 zamówienia
    if (!fakturowniaOrderId) {
      return await saveInvoiceWithoutProvider(
        supabase,
        bookingId,
        paymentHistoryId,
        amountCents,
        invoiceType,
        parentInvoice?.id || null,
        "Błąd Fakturownia: Zaliczka musi być podpięta do jednego zamówienia (KSeF). Brak order_id dla rezerwacji."
      );
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
      oid: fakturowniaOrderId,
      external_order_ref: booking.booking_ref || undefined,
      advance_creation_mode: "amount",
      advance_value: paymentAmountZloty,
      position_name: invoiceDescription,
      from_invoice_id:
        parentInvoice?.fakturownia_invoice_id
          ? parseInt(parentInvoice.fakturownia_invoice_id, 10)
          : undefined,
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

    // ─── 12. Pobierz PDF i wyślij email (asynchronicznie; na Vercel użyj scheduleAfterResponse + waitUntil) ───
    if (fakturowniaResponse.success && fakturowniaResponse.invoiceId) {
      const bgTask = fetchPdfAndSendEmail(
        fakturowniaConfig,
        supabase,
        invoice.id,
        fakturowniaResponse.invoiceId,
        fakturowniaResponse.pdfUrl,
        booking as BookingData,
        invoice.invoice_number
      );
      if (scheduleAfterResponse) {
        scheduleAfterResponse(bgTask);
      } else {
        bgTask.catch((err) => {
          console.error("[InvoiceService] Background PDF/email task failed:", err);
        });
      }
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

const PDF_INITIAL_DELAY_MS = 3000;
const PDF_RETRY_DELAY_MS = 4000;
const PDF_MAX_ATTEMPTS = 6;

async function fetchPdfAndSendEmail(
  config: FakturowniaConfig,
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  fakturowniaInvoiceId: number,
  pdfUrlFromResponse: string | undefined,
  booking: BookingData,
  invoiceNumber: string
): Promise<void> {
  console.log(
    `[InvoiceService] Waiting ${PDF_INITIAL_DELAY_MS}ms before PDF fetch (Fakturownia generation)...`
  );
  await delay(PDF_INITIAL_DELAY_MS);

  let lastErr: unknown;
  for (let attempt = 0; attempt < PDF_MAX_ATTEMPTS; attempt++) {
    let pdfUrl = pdfUrlFromResponse;
    if (attempt > 0 || !pdfUrl) {
      const refreshed = await getInvoice(config, fakturowniaInvoiceId);
      if (refreshed.success && refreshed.pdfUrl) {
        pdfUrl = refreshed.pdfUrl;
      }
    }
    if (!pdfUrl) {
      pdfUrl = buildInvoicePdfUrl(config, fakturowniaInvoiceId);
    }

    try {
      console.log(`[InvoiceService] PDF download attempt ${attempt + 1}/${PDF_MAX_ATTEMPTS}:`, pdfUrl);
      const pdfBuffer = await downloadPdf(pdfUrl);
      console.log("[InvoiceService] PDF downloaded, size:", pdfBuffer.length, "bytes");
      await persistPdfAndSendEmail(supabase, invoiceId, pdfUrl, pdfBuffer, booking, invoiceNumber);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[InvoiceService] PDF attempt ${attempt + 1} failed:`, err);
      if (attempt < PDF_MAX_ATTEMPTS - 1) {
        await delay(PDF_RETRY_DELAY_MS);
      }
    }
  }

  console.error("[InvoiceService] PDF download exhausted retries:", lastErr);
  await supabase
    .from("invoices")
    .update({
      invoice_provider_error:
        "PDF download failed after retries: " +
        (lastErr instanceof Error ? lastErr.message : String(lastErr)),
    })
    .eq("id", invoiceId);
}

async function persistPdfAndSendEmail(
  supabase: ReturnType<typeof createAdminClient>,
  invoiceId: string,
  pdfUrl: string,
  pdfBuffer: Buffer,
  booking: BookingData,
  invoiceNumber: string
): Promise<void> {
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
    // Publiczny numer (dla klienta) — nie pokazujemy booking_ref (to jest externalId Paynow)
    let publicAgreementNumber: string | null = null;
    try {
      const { formatAgreementNumber } = await import("@/lib/agreements/format-agreement-number");
      const { data: agreementRow } = await supabase
        .from("agreements")
        .select("agreement_seq")
        .eq("booking_id", booking.id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("generated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      const seq = agreementRow?.agreement_seq;

      const { data: bookingRow } = await supabase
        .from("bookings")
        .select("trip_id, trips:trips(reservation_number)")
        .eq("id", booking.id)
        .single();

      const trip = Array.isArray((bookingRow as any)?.trips) ? (bookingRow as any).trips[0] : (bookingRow as any)?.trips;
      const reservationNumber = trip?.reservation_number ?? null;

      publicAgreementNumber = formatAgreementNumber({
        reservationNumber,
        agreementSeq: typeof seq === "number" ? seq : null,
      }).replace(/^#/, "");
      if (publicAgreementNumber === "-") publicAgreementNumber = null;
    } catch (e) {
      console.warn("[InvoiceService] Failed to compute public agreement number:", e);
      publicAgreementNumber = null;
    }

    console.log("[InvoiceService] Sending invoice email:", {
      invoiceId,
      booking_ref: booking.booking_ref,
      invoiceNumber,
      to: booking.contact_email,
      storagePath,
    });
    try {
      const pdfBase64 = pdfBuffer.toString("base64");
      const sendResult = await sendTransactionalEmail({
        to: booking.contact_email,
        subject: `Faktura zaliczkowa ${invoiceNumber} – Magia Podróżowania`,
        html: buildInvoiceEmailHtml(invoiceNumber, publicAgreementNumber || "—"),
        text: `W załączniku przesyłamy fakturę zaliczkową ${invoiceNumber} dla umowy ${publicAgreementNumber || "—"}.\n\nDziękujemy za wpłatę!\n\nMagia Podróżowania`,
        attachment: {
          filename: `${safeInvoiceNumber}.pdf`,
          base64: pdfBase64,
        },
      });

      if (sendResult.ok) {
        console.log("[InvoiceService] Invoice email sent:", {
          invoiceId,
          booking_ref: booking.booking_ref,
          invoiceNumber,
          to: booking.contact_email,
        });
        await supabase.from("invoices").update({ status: "wysłana" }).eq("id", invoiceId);
      } else {
        console.error("[InvoiceService] Failed to send invoice email:", {
          invoiceId,
          booking_ref: booking.booking_ref,
          invoiceNumber,
          to: booking.contact_email,
          error: sendResult.error,
        });
        await supabase
          .from("invoices")
          .update({
            invoice_provider_error: `Email send failed: ${sendResult.error}`,
          })
          .eq("id", invoiceId);
      }
    } catch (emailErr) {
      console.error("[InvoiceService] Error sending invoice email:", {
        invoiceId,
        booking_ref: booking.booking_ref,
        invoiceNumber,
        to: booking.contact_email,
        err: emailErr,
      });
      await supabase
        .from("invoices")
        .update({
          invoice_provider_error:
            "Email send threw exception: " +
            (emailErr instanceof Error ? emailErr.message : String(emailErr)),
        })
        .eq("id", invoiceId);
    }
  } else {
    console.warn("[InvoiceService] Missing booking.contact_email; skipping invoice email:", {
      invoiceId,
      booking_ref: booking.booking_ref,
      invoiceNumber,
    });
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

function buildInvoiceEmailHtml(invoiceNumber: string, publicAgreementNumber: string): string {
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
                    dla umowy <strong>${publicAgreementNumber}</strong>.
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
