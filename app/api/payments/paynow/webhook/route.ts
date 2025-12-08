import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Wymuś dynamiczne renderowanie - wyłącz cache całkowicie
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Szukaj rezerwacji - sprawdź zarówno booking_ref jak i możliwe warianty
  let booking = null;
  let bookingError = null;
  
  // Najpierw spróbuj znaleźć po dokładnym booking_ref
  const { data: bookingData, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, trip_id, contact_email, payment_status, booking_ref")
    .eq("booking_ref", payload.externalId)
    .single();

  if (bookingErr || !bookingData) {
    // Jeśli nie znaleziono, spróbuj znaleźć po częściowym dopasowaniu (może być różnica w formacie)
    console.warn(`[Paynow Webhook] Booking not found with exact match for externalId: ${payload.externalId}, trying partial match...`);
    const { data: partialBooking, error: partialError } = await supabase
      .from("bookings")
      .select("id, trip_id, contact_email, payment_status, booking_ref")
      .ilike("booking_ref", `%${payload.externalId}%`)
      .limit(1)
      .single();
    
    if (!partialError && partialBooking) {
      booking = partialBooking;
      console.log(`[Paynow Webhook] Found booking with partial match: ${partialBooking.booking_ref} for externalId: ${payload.externalId}`);
    } else {
      bookingError = bookingErr || partialError;
    }
  } else {
    booking = bookingData;
  }

  if (bookingError || !booking) {
    console.error(`[Paynow Webhook] Booking not found for externalId: ${payload.externalId}`, {
      error: bookingError,
      externalId: payload.externalId,
      paymentId: payload.paymentId,
      searchedExact: true,
      searchedPartial: true,
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

  // Aktualizuj status płatności i status rezerwacji w rezerwacji
  console.log(`[Paynow Webhook] Updating booking ${booking.id} (${payload.externalId}) payment status from ${booking.payment_status} to ${newPaymentStatus}`);
  console.log(`[Paynow Webhook] Payment details: paymentId=${payload.paymentId}, status=${status}, amount=${amountCents} cents`);
  
  // Przygotuj obiekt aktualizacji - jeśli płatność jest potwierdzona, ustaw również status rezerwacji na "confirmed"
  const updateData: { payment_status: string; status?: string } = { payment_status: newPaymentStatus };
  if (status === "CONFIRMED") {
    // Aktualizuj status rezerwacji na "confirmed" gdy płatność jest potwierdzona
    updateData.status = "confirmed";
    console.log(`[Paynow Webhook] Also updating booking status to "confirmed"`);
  }
  
  // Sprawdź czy aktualizacja jest potrzebna (czy status się zmieni)
  if (booking.payment_status === newPaymentStatus) {
    console.log(`[Paynow Webhook] Booking ${booking.id} already has payment_status=${newPaymentStatus}, skipping update`);
  } else {
    const { error: updateError, data: updatedBooking } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", booking.id)
      .select()
      .single();

    if (updateError) {
      console.error(`[Paynow Webhook] Failed to update booking payment status:`, {
        bookingId: booking.id,
        bookingRef: payload.externalId,
        error: updateError,
        attemptedStatus: newPaymentStatus,
        updateData: updateData,
      });
      return NextResponse.json({ error: "update_failed", details: updateError.message }, { status: 500 });
    }

    console.log(`[Paynow Webhook] Successfully updated booking ${booking.id} payment status to ${newPaymentStatus}`, {
      bookingId: booking.id,
      bookingRef: payload.externalId,
      oldStatus: booking.payment_status,
      newStatus: newPaymentStatus,
      updatedBooking: updatedBooking,
    });

    // Zweryfikuj, że aktualizacja się powiodła - pobierz zaktualizowane dane
    const { data: verifyBooking } = await supabase
      .from("bookings")
      .select("id, payment_status, status")
      .eq("id", booking.id)
      .single();
    
    console.log(`[Paynow Webhook] Verification - booking ${booking.id} now has payment_status=${verifyBooking?.payment_status}, status=${verifyBooking?.status}`);
  }

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


