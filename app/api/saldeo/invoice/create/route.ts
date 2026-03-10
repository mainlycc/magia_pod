import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPaymentInvoice } from "@/lib/invoices/invoice-service";

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

    const adminSupabase = createAdminClient();

    // Jeśli podano payment_id, użyj go bezpośrednio
    let paymentHistoryId: string | null = payment_id || null;
    let amountCents: number = 0;

    if (paymentHistoryId) {
      // Pobierz kwotę z istniejącego wpisu payment_history
      const { data: payment } = await adminSupabase
        .from("payment_history")
        .select("id, amount_cents")
        .eq("id", paymentHistoryId)
        .single();

      if (payment) {
        amountCents = payment.amount_cents;
      }
    }

    if (!paymentHistoryId || amountCents === 0) {
      // Jeśli nie podano payment_id, pobierz ostatnią płatność
      const { data: lastPayment } = await adminSupabase
        .from("payment_history")
        .select("id, amount_cents")
        .eq("booking_id", booking_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (lastPayment) {
        paymentHistoryId = lastPayment.id;
        amountCents = lastPayment.amount_cents;
      }
    }

    if (!paymentHistoryId || amountCents === 0) {
      // Jeśli nadal brak - pobierz kwotę z bookingu i utwórz payment_history
      const { data: booking } = await adminSupabase
        .from("bookings")
        .select("paid_amount_cents")
        .eq("id", booking_id)
        .single();

      amountCents = booking?.paid_amount_cents || 0;

      if (amountCents <= 0) {
        return NextResponse.json(
          { error: "no_payment_found", message: "Brak wpłaty do zafakturowania" },
          { status: 400 }
        );
      }

      // Utwórz wpis payment_history
      const { data: newPayment, error: phError } = await adminSupabase
        .from("payment_history")
        .insert({
          booking_id: booking_id,
          amount_cents: amountCents,
          payment_method: "manual",
          notes: "Ręczne wystawienie faktury przez admina",
        })
        .select()
        .single();

      if (phError || !newPayment) {
        return NextResponse.json(
          { error: "payment_history_error", message: "Nie udało się utworzyć wpisu płatności" },
          { status: 500 }
        );
      }

      paymentHistoryId = newPayment.id;
    }

    // Deleguj do centralnego serwisu faktur
    const result = await processPaymentInvoice({
      bookingId: booking_id,
      paymentHistoryId: paymentHistoryId!,
      amountCents: amountCents,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        invoice_id: result.invoiceId,
        invoice_number: result.invoiceNumber,
        saldeo_invoice_id: result.saldeoInvoiceId || null,
        message: result.saldeoInvoiceId
          ? "Faktura zaliczkowa została wygenerowana i zapisana w Saldeo"
          : "Faktura została zapisana lokalnie (Saldeo w toku lub niedostępne)",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: "Nie udało się wygenerować faktury",
        },
        { status: 500 }
      );
    }
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
