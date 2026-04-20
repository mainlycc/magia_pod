import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processPaymentInvoice } from "@/lib/invoices/invoice-service";
import { recalculateBookingPaymentsFromHistory } from "@/lib/bookings/recalculate-booking-payments";

const paymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

const deleteSchema = z.object({
  payment_id: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const recalc = await recalculateBookingPaymentsFromHistory(supabase, id);
  if (!recalc.ok) {
    console.warn("[GET payments] recalculateBookingPaymentsFromHistory:", recalc.error);
  }

  const { data, error } = await supabase
    .from("payment_history")
    .select(`
      *,
      invoice:invoices!invoices_payment_history_id_fkey(
        id,
        invoice_number,
        fakturownia_invoice_id,
        invoice_provider_error
      )
    `)
    .eq("booking_id", id)
    .order("payment_date", { ascending: false });

  if (error) {
    console.error("Failed to fetch payment history", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  // Normalize: invoice może być tablicą w zależności od Supabase – spłaszcz do obiektu lub null
  const normalized = (data || []).map((entry: any) => ({
    ...entry,
    invoice: Array.isArray(entry.invoice) ? (entry.invoice[0] ?? null) : (entry.invoice ?? null),
  }));

  return NextResponse.json(normalized);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let payload: z.infer<typeof paymentSchema>;

  try {
    const body = await request.json();
    payload = paymentSchema.parse(body);
  } catch (error) {
    console.error("Invalid payload for POST /api/bookings/[id]/payments", error);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createClient();

  // Sprawdź czy rezerwacja istnieje
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
      id,
      payment_status,
      trip_id,
      first_payment_amount_cents,
      second_payment_amount_cents,
      trips:trips(price_cents)
    `,
    )
    .eq("id", id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  // Dodaj płatność
  const { data: payment, error: paymentError } = await supabase
    .from("payment_history")
    .insert({
      booking_id: id,
      amount_cents: payload.amount_cents,
      payment_date: payload.payment_date || new Date().toISOString().split("T")[0],
      payment_method: payload.payment_method || null,
      notes: payload.notes || null,
    })
    .select("*")
    .single();

  if (paymentError) {
    console.error("Failed to create payment", paymentError);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  const recalc = await recalculateBookingPaymentsFromHistory(supabase, id);
  if (!recalc.ok) {
    console.error("[POST payments] recalculateBookingPaymentsFromHistory failed:", recalc.error);
    return NextResponse.json({ error: "recalc_failed" }, { status: 500 });
  }

  // Wystaw fakturę dla każdej wpłaty (asynchronicznie, nie blokujemy odpowiedzi)
  if (payment && payload.amount_cents > 0) {
    processPaymentInvoice({
      bookingId: id,
      paymentHistoryId: payment.id,
      amountCents: payload.amount_cents,
    }).catch((err) => {
      console.error("[Payments API] Error creating invoice:", err);
    });
  }

  return NextResponse.json(payment);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let payload: z.infer<typeof deleteSchema>;

  try {
    const body = await request.json();
    payload = deleteSchema.parse(body);
  } catch (error) {
    console.error("Invalid payload for DELETE /api/bookings/[id]/payments", error);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createClient();

  // Upewnij się, że booking istnieje i pobierz dane do przeliczeń
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
      id,
      trip_id,
      first_payment_amount_cents,
      second_payment_amount_cents,
      trips:trips(price_cents)
    `,
    )
    .eq("id", id)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  // Usuń wpis historii płatności (tylko jeśli należy do tego bookingu)
  const { error: deleteError } = await supabase
    .from("payment_history")
    .delete()
    .eq("id", payload.payment_id)
    .eq("booking_id", id);

  if (deleteError) {
    console.error("Failed to delete payment history entry", deleteError);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const recalc = await recalculateBookingPaymentsFromHistory(supabase, id);
  if (!recalc.ok) {
    console.error("[DELETE payments] recalculateBookingPaymentsFromHistory failed:", recalc.error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

