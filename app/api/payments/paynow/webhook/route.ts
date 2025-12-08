import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Paynow v3 webhook payload format
type PaynowWebhookPayload = {
  paymentId: string;
  externalId: string;
  status: string;
  modifiedAt: string;
  amount: number; // W v3 amount jest liczbą (w groszach), nie obiektem
};

function getSignatureKey() {
  const signatureKey = process.env.PAYNOW_SIGNATURE_KEY;
  if (!signatureKey) {
    throw new Error("Paynow signature key not configured");
  }
  return signatureKey;
}

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const key = getSignatureKey();
  // Paynow v3 używa base64 dla sygnatury
  const expected = crypto.createHmac("sha256", key).update(rawBody).digest("base64");
  return expected === signatureHeader;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  // Paynow v3 używa nagłówka "Signature" zamiast "x-signature"
  const signature = request.headers.get("Signature");

  // Logowanie dla debugowania (tylko w development)
  if (process.env.NODE_ENV === "development") {
    console.log("Paynow webhook received:", {
      hasBody: !!rawBody,
      bodyLength: rawBody.length,
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      headers: Object.fromEntries(request.headers.entries()),
    });
  }

  if (!verifySignature(rawBody, signature)) {
    console.error("Invalid signature in Paynow webhook", {
      receivedSignature: signature,
      bodyPreview: rawBody.substring(0, 200),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let payload: PaynowWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaynowWebhookPayload;
    console.log("Paynow webhook payload:", payload);
  } catch (error) {
    console.error("Failed to parse webhook payload:", error, rawBody);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, trip_id, contact_email, payment_status")
    .eq("booking_ref", payload.externalId)
    .single();

  if (bookingError || !booking) {
    console.error("Booking not found for externalId:", payload.externalId);
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  const status = payload.status.toUpperCase();
  const amountCents = payload.amount ?? 0;

  // Obsługa różnych statusów płatności Paynow v3
  let newPaymentStatus: "unpaid" | "partial" | "paid" | "overpaid" = booking.payment_status as any;
  let shouldUpdatePaymentHistory = false;

  switch (status) {
    case "CONFIRMED":
      // Płatność potwierdzona - oznacza pełną płatność
      newPaymentStatus = "paid";
      shouldUpdatePaymentHistory = true;
      break;
    case "PENDING":
      // Płatność oczekująca - nie zmieniamy statusu, ale logujemy
      console.log(`Payment ${payload.paymentId} is pending for booking ${payload.externalId}`);
      return NextResponse.json({ ok: true });
    case "REJECTED":
      // Płatność odrzucona - nie zmieniamy statusu
      console.log(`Payment ${payload.paymentId} was rejected for booking ${payload.externalId}`);
      return NextResponse.json({ ok: true });
    case "EXPIRED":
      // Płatność wygasła - nie zmieniamy statusu
      console.log(`Payment ${payload.paymentId} expired for booking ${payload.externalId}`);
      return NextResponse.json({ ok: true });
    default:
      // Dla innych statusów nie zmieniamy nic
      console.log(`Unknown payment status: ${status} for payment ${payload.paymentId}`);
      return NextResponse.json({ ok: true });
  }

  // Zapisz wpis w historii płatności tylko dla potwierdzonych płatności
  if (shouldUpdatePaymentHistory && amountCents > 0) {
    const { error: historyError } = await supabase.from("payment_history").insert({
      booking_id: booking.id,
      amount_cents: amountCents,
      payment_method: "paynow",
      notes: `Paynow payment ${payload.paymentId} - status: ${status}`,
    });

    if (historyError) {
      console.error("Failed to insert payment history:", historyError);
    }
  }

  // Aktualizuj status płatności w rezerwacji
  console.log(`Updating booking ${booking.id} (${payload.externalId}) payment status from ${booking.payment_status} to ${newPaymentStatus}`);
  
  const { error: updateError, data: updatedBooking } = await supabase
    .from("bookings")
    .update({ payment_status: newPaymentStatus })
    .eq("id", booking.id)
    .select()
    .single();

  if (updateError) {
    console.error("Failed to update booking payment status:", updateError);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  console.log(`Successfully updated booking ${booking.id} payment status to ${newPaymentStatus}`, updatedBooking);

  // Wyślij mail potwierdzający opłacenie rezerwacji tylko dla potwierdzonych płatności
  if (status === "CONFIRMED" && booking.contact_email) {
    try {
      const { origin } = new URL(request.url);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? origin;

      await fetch(`${baseUrl}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: booking.contact_email,
          subject: `Płatność potwierdzona dla rezerwacji ${payload.externalId}`,
          text: `Dziękujemy! Płatność za rezerwację ${payload.externalId} została zaksięgowana.`,
        }),
      });
    } catch (err) {
      // Błąd wysyłki maila nie powinien blokować obsługi webhooka
      console.error("Failed to send payment confirmation email", err);
    }
  }

  return NextResponse.json({ ok: true });
}


