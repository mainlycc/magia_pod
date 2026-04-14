import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { processPaymentInvoice } from "@/lib/invoices/invoice-service";

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

  // Oblicz sumę płatności i zaktualizuj status
  const { data: payments } = await supabase
    .from("payment_history")
    .select("amount_cents")
    .eq("booking_id", id);

  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
  const trip =
    Array.isArray((booking as any).trips) ? (booking as any).trips[0] : (booking as any).trips;
  const tripPrice =
    trip?.price_cents ?? (booking.trip_id ? await getTripPrice(supabase, booking.trip_id) : 0);

  let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = "unpaid";
  if (totalPaid >= tripPrice) {
    newPaymentStatus = totalPaid > tripPrice ? "overpaid" : "paid";
  } else if (totalPaid > 0) {
    newPaymentStatus = "partial";
  }

  // Przelicz statusy rat na podstawie sumy wpłat
  const firstAmount = booking.first_payment_amount_cents ?? 0;
  const secondAmount = booking.second_payment_amount_cents ?? 0;
  const firstPaymentStatus = firstAmount > 0 ? (totalPaid >= firstAmount ? "paid" : "unpaid") : null;
  const secondPaymentStatus =
    secondAmount > 0 ? (totalPaid >= firstAmount + secondAmount ? "paid" : "unpaid") : null;

  // Aktualizuj kwotę i status płatności w rezerwacji
  await supabase
    .from("bookings")
    .update({
      paid_amount_cents: totalPaid,
      payment_status: newPaymentStatus,
      ...(firstPaymentStatus ? { first_payment_status: firstPaymentStatus } : {}),
      ...(secondPaymentStatus ? { second_payment_status: secondPaymentStatus } : {}),
    })
    .eq("id", id);

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

  // Przelicz sumę wpłat
  const { data: payments, error: paymentsError } = await supabase
    .from("payment_history")
    .select("amount_cents")
    .eq("booking_id", id);

  if (paymentsError) {
    console.error("Failed to fetch payment history after delete", paymentsError);
    return NextResponse.json({ error: "recalc_failed" }, { status: 500 });
  }

  const totalPaid = payments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0;
  const trip = Array.isArray((booking as any).trips) ? (booking as any).trips[0] : (booking as any).trips;
  const tripPrice = trip?.price_cents || 0;

  let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = "unpaid";
  if (totalPaid >= tripPrice) {
    newPaymentStatus = totalPaid > tripPrice ? "overpaid" : "paid";
  } else if (totalPaid > 0) {
    newPaymentStatus = "partial";
  }

  // Przelicz statusy rat na podstawie sumy wpłat
  const firstAmount = booking.first_payment_amount_cents ?? 0;
  const secondAmount = booking.second_payment_amount_cents ?? 0;
  const firstPaymentStatus = firstAmount > 0 ? (totalPaid >= firstAmount ? "paid" : "unpaid") : null;
  const secondPaymentStatus =
    secondAmount > 0 ? (totalPaid >= firstAmount + secondAmount ? "paid" : "unpaid") : null;

  const { error: bookingUpdateError } = await supabase
    .from("bookings")
    .update({
      paid_amount_cents: totalPaid,
      payment_status: newPaymentStatus,
      ...(firstPaymentStatus ? { first_payment_status: firstPaymentStatus } : {}),
      ...(secondPaymentStatus ? { second_payment_status: secondPaymentStatus } : {}),
    })
    .eq("id", id);

  if (bookingUpdateError) {
    console.error("Failed to update booking after payment delete", bookingUpdateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

async function getTripPrice(supabase: any, tripId: string): Promise<number> {
  const { data } = await supabase
    .from("trips")
    .select("price_cents")
    .eq("id", tripId)
    .single();

  return data?.price_cents || 0;
}

