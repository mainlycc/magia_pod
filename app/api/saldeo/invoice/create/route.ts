import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createInvoiceInSaldeo,
  type SaldeoConfig,
  type InvoiceData,
  type BuyerData,
} from "@/lib/saldeo/client";

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { booking_id, payment_id } = body;

    if (!booking_id) {
      return NextResponse.json({ error: "booking_id is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Sprawdź czy faktura już istnieje dla tego booking_id
    const { data: existingInvoice } = await supabase
      .from("invoices")
      .select("id, saldeo_invoice_id")
      .eq("booking_id", booking_id)
      .single();

    if (existingInvoice) {
      return NextResponse.json({
        success: false,
        error: "Invoice already exists for this booking",
        invoice_id: existingInvoice.id,
        saldeo_invoice_id: existingInvoice.saldeo_invoice_id,
      });
    }

    // Pobierz dane booking z wszystkimi potrzebnymi polami
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        `
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
        company_address
      `
      )
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }

    // Pobierz dane wycieczki
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, title, price_cents")
      .eq("id", booking.trip_id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ error: "trip_not_found" }, { status: 404 });
    }

    // Pobierz liczbę uczestników
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("id")
      .eq("booking_id", booking_id);

    if (participantsError) {
      console.error("Error fetching participants:", participantsError);
    }

    const participantsCount = participants?.length || 1;

    // Pobierz dane płatności (jeśli payment_id podane)
    let paymentDate = new Date().toISOString().split("T")[0];
    let paymentAmount = trip.price_cents || 0;

    if (payment_id) {
      const { data: payment } = await supabase
        .from("payment_history")
        .select("payment_date, amount_cents")
        .eq("id", payment_id)
        .single();

      if (payment) {
        paymentDate = payment.payment_date || paymentDate;
        paymentAmount = payment.amount_cents || paymentAmount;
      }
    } else {
      // Jeśli nie ma payment_id, pobierz ostatnią płatność
      const { data: lastPayment } = await supabase
        .from("payment_history")
        .select("payment_date, amount_cents")
        .eq("booking_id", booking_id)
        .order("payment_date", { ascending: false })
        .limit(1)
        .single();

      if (lastPayment) {
        paymentDate = lastPayment.payment_date || paymentDate;
        paymentAmount = lastPayment.amount_cents || paymentAmount;
      }
    }

    // Przygotuj dane kontrahenta na podstawie invoice_type
    const buyerData = prepareBuyerData(booking);

    if (!buyerData.name) {
      return NextResponse.json(
        { error: "buyer_data_missing", message: "Brak danych kontrahenta do faktury" },
        { status: 400 }
      );
    }

    // Przygotuj konfigurację Saldeo z zmiennych środowiskowych
    const saldeoConfig: SaldeoConfig = {
      username: process.env.SALDEO_USERNAME || "",
      apiToken: process.env.SALDEO_API_TOKEN || "",
      companyProgramId: process.env.SALDEO_COMPANY_PROGRAM_ID || "",
      apiUrl: process.env.SALDEO_API_URL || "https://saldeo-test.brainshare.pl",
    };

    if (!saldeoConfig.username || !saldeoConfig.apiToken || !saldeoConfig.companyProgramId) {
      return NextResponse.json(
        { error: "saldeo_config_missing", message: "Brak konfiguracji Saldeo w zmiennych środowiskowych" },
        { status: 500 }
      );
    }

    // Oblicz kwotę faktury (cena jednostkowa * liczba uczestników)
    const unitPrice = (trip.price_cents || 0) / 100; // w złotych
    const totalAmount = unitPrice * participantsCount;

    // Przygotuj dane faktury
    const invoiceData: InvoiceData = {
      saleDate: paymentDate,
      buyer: buyerData,
      items: [
        {
          name: trip.title || "Wycieczka",
          quantity: participantsCount,
          unitPrice: unitPrice,
          vatRate: 23, // 23% VAT domyślnie
        },
      ],
      // Nie podajemy invoiceNumber - Saldeo użyje własnej numeracji
    };

    // Wyślij fakturę do Saldeo
    const saldeoResponse = await createInvoiceInSaldeo(saldeoConfig, invoiceData);

    // Zapisz fakturę w bazie danych
    const adminSupabase = createAdminClient();
    const invoiceAmountCents = Math.round(totalAmount * 100);

    const { data: invoice, error: invoiceError } = await adminSupabase
      .from("invoices")
      .insert({
        booking_id: booking_id,
        amount_cents: invoiceAmountCents,
        status: saldeoResponse.success ? "wystawiona" : "wystawiona", // zawsze "wystawiona" nawet jeśli błąd
        saldeo_invoice_id: saldeoResponse.invoiceId || null,
        saldeo_error: saldeoResponse.error || null,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Error creating invoice:", invoiceError);
      return NextResponse.json(
        {
          success: false,
          error: "failed_to_create_invoice",
          saldeo_response: saldeoResponse,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: saldeoResponse.success,
      invoice_id: invoice.id,
      saldeo_invoice_id: saldeoResponse.invoiceId,
      saldeo_error: saldeoResponse.error,
      invoice_number: invoice.invoice_number,
    });
  } catch (error) {
    console.error("Error in POST /api/saldeo/invoice/create:", error);
    return NextResponse.json(
      {
        success: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Przygotowuje dane kontrahenta na podstawie invoice_type z booking
 */
function prepareBuyerData(booking: any): BuyerData {
  const invoiceType = booking.invoice_type || "contact";

  switch (invoiceType) {
    case "contact": {
      // Dane osoby kontaktowej
      const firstName = booking.contact_first_name || "";
      const lastName = booking.contact_last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || booking.contact_email || "";

      return {
        name: fullName,
        address: booking.address
          ? {
              street: booking.address.street || "",
              city: booking.address.city || "",
              zip: booking.address.zip || "",
            }
          : undefined,
      };
    }

    case "company": {
      // Dane firmy z formularza
      return {
        name: booking.company_name || "",
        nip: booking.company_nip || undefined,
        address: booking.company_address
          ? {
              street: booking.company_address.street || "",
              city: booking.company_address.city || "",
              zip: booking.company_address.zip || "",
            }
          : undefined,
      };
    }

    case "custom": {
      // Osobno podane dane do faktury
      return {
        name: booking.invoice_name || "",
        nip: booking.invoice_nip || undefined,
        address: booking.invoice_address
          ? {
              street: booking.invoice_address.street || "",
              city: booking.invoice_address.city || "",
              zip: booking.invoice_address.zip || "",
            }
          : undefined,
      };
    }

    default:
      // Fallback do danych kontaktowych
      const firstName = booking.contact_first_name || "";
      const lastName = booking.contact_last_name || "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || booking.contact_email || "";

      return {
        name: fullName,
        address: booking.address
          ? {
              street: booking.address.street || "",
              city: booking.address.city || "",
              zip: booking.address.zip || "",
            }
          : undefined,
      };
  }
}

