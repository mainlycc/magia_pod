import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const paymentSchema = z.object({
  amount_cents: z.number().int().positive(),
  payment_date: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payment_history")
    .select("*")
    .eq("booking_id", id)
    .order("payment_date", { ascending: false });

  if (error) {
    console.error("Failed to fetch payment history", error);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }

  return NextResponse.json(data || []);
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
    .select("id, payment_status, trip_id")
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
  const tripPrice = booking.trip_id ? await getTripPrice(supabase, booking.trip_id) : 0;

  let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = "unpaid";
  if (totalPaid >= tripPrice) {
    newPaymentStatus = totalPaid > tripPrice ? "overpaid" : "paid";
  } else if (totalPaid > 0) {
    newPaymentStatus = "partial";
  }

  // Aktualizuj status płatności w rezerwacji
  await supabase
    .from("bookings")
    .update({ payment_status: newPaymentStatus })
    .eq("id", id);

  // Wystaw fakturę automatycznie dla płatności z statusem "paid" lub "partial"
  if (newPaymentStatus === "paid" || newPaymentStatus === "partial") {
    try {
      // Sprawdź czy faktura już istnieje dla tego booking_id
      const { data: existingInvoice } = await supabase
        .from("invoices")
        .select("id")
        .eq("booking_id", id)
        .single();

      if (!existingInvoice && payment) {
        console.log(`[Payments API] Creating invoice for booking ${id}`);

        // Pobierz baseUrl dla wywołania API
        const { origin } = new URL(request.url);
        let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
        
        if (!baseUrl && process.env.VERCEL_URL) {
          baseUrl = `https://${process.env.VERCEL_URL}`;
        }
        
        if (!baseUrl) {
          baseUrl = origin;
        }

        // Wywołaj endpoint do wystawiania faktury (asynchronicznie, nie blokujemy odpowiedzi)
        fetch(`${baseUrl}/api/saldeo/invoice/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            booking_id: id,
            payment_id: payment.id,
          }),
        }).catch((err) => {
          console.error("[Payments API] Error creating invoice:", err);
        });
      }
    } catch (err) {
      // Błąd wystawiania faktury nie powinien blokować odpowiedzi
      console.error("[Payments API] Error in invoice creation logic:", err);
    }
  }

  return NextResponse.json(payment);
}

async function getTripPrice(supabase: any, tripId: string): Promise<number> {
  const { data } = await supabase
    .from("trips")
    .select("price_cents")
    .eq("id", tripId)
    .single();

  return data?.price_cents || 0;
}

