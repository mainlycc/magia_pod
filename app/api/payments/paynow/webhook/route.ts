import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Logowanie dla debugowania (zawsze, aby móc debugować w produkcji)
  console.log("Paynow webhook received:", {
    hasBody: !!rawBody,
    bodyLength: rawBody.length,
    hasSignature: !!signature,
    signatureLength: signature?.length || 0,
    timestamp: new Date().toISOString(),
    // Nie loguj pełnych headers w produkcji ze względów bezpieczeństwa
    ...(process.env.NODE_ENV === "development" 
      ? { headers: Object.fromEntries(request.headers.entries()) }
      : {}),
  });

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

  // Webhook musi omijać RLS – używamy admin clienta
  const supabase = createAdminClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, trip_id, contact_email, payment_status")
    .eq("booking_ref", payload.externalId)
    .single();

  if (bookingError || !booking) {
    console.error(`[Paynow Webhook] Booking not found for externalId: ${payload.externalId}`, {
      error: bookingError,
      externalId: payload.externalId,
      paymentId: payload.paymentId,
    });
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  console.log(`[Paynow Webhook] Found booking:`, {
    bookingId: booking.id,
    bookingRef: payload.externalId,
    currentPaymentStatus: booking.payment_status,
    paymentId: payload.paymentId,
  });

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
  console.log(`[Paynow Webhook] Updating booking ${booking.id} (${payload.externalId}) payment status from ${booking.payment_status} to ${newPaymentStatus}`);
  console.log(`[Paynow Webhook] Payment details: paymentId=${payload.paymentId}, status=${status}, amount=${amountCents} cents`);
  
  const { error: updateError, data: updatedBooking } = await supabase
    .from("bookings")
    .update({ payment_status: newPaymentStatus })
    .eq("id", booking.id)
    .select()
    .single();

  if (updateError) {
    console.error(`[Paynow Webhook] Failed to update booking payment status:`, {
      bookingId: booking.id,
      bookingRef: payload.externalId,
      error: updateError,
      attemptedStatus: newPaymentStatus,
    });
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  console.log(`[Paynow Webhook] Successfully updated booking ${booking.id} payment status to ${newPaymentStatus}`, {
    bookingId: booking.id,
    bookingRef: payload.externalId,
    oldStatus: booking.payment_status,
    newStatus: newPaymentStatus,
    updatedBooking: updatedBooking,
  });

  // Wyślij mail potwierdzający opłacenie rezerwacji tylko dla potwierdzonych płatności
  if (status === "CONFIRMED" && booking.contact_email) {
    try {
      // Pobierz baseUrl - w produkcji MUSI być ustawiony NEXT_PUBLIC_BASE_URL
      const { origin } = new URL(request.url);
      let baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
      
      // Jeśli nie ma NEXT_PUBLIC_BASE_URL, sprawdź VERCEL_URL (dla Vercel deployment)
      if (!baseUrl && process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      }
      
      // Fallback na origin tylko w development (localhost)
      if (!baseUrl) {
        baseUrl = origin;
        console.warn("NEXT_PUBLIC_BASE_URL nie jest ustawione - używany jest origin z requestu. To może powodować problemy w produkcji!");
      }

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


