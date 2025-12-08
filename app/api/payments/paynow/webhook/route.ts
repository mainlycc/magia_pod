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
  if (!signatureHeader) {
    console.error("[Paynow Webhook] Missing signature header");
    return false;
  }
  
  try {
    const key = getSignatureKey();
    
    // Zgodnie z dokumentacją Paynow v3 dla notifications:
    // "The Signature should be calculated using the HMAC SHA256 algorithm using the message body 
    // and Signature-Key. The binary result of the hash function should be encoded using Base64 
    // and sent in the Signature header."
    // 
    // Dla notifications sygnatura jest obliczana BEZPOŚREDNIO z body (jako string JSON),
    // a NIE z obiektu zawierającego headers, parameters i body jak w przypadku requestów API.
    // 
    // Ważne: używamy dokładnie tego samego rawBody, które otrzymaliśmy, bez żadnych modyfikacji
    const expected = crypto
      .createHmac("sha256", key)
      .update(rawBody, "utf8")
      .digest("base64");
    
    // Porównaj sygnatury (case-sensitive)
    // Usuń białe znaki z końca sygnatury (może być problem z formatowaniem)
    const cleanedExpected = expected.trim();
    const cleanedReceived = signatureHeader.trim();
    const isValid = cleanedExpected === cleanedReceived;
    
    if (!isValid) {
      console.error("[Paynow Webhook] Signature verification failed", {
        expectedLength: cleanedExpected.length,
        receivedLength: cleanedReceived.length,
        expectedPrefix: cleanedExpected.substring(0, 20),
        receivedPrefix: cleanedReceived.substring(0, 20),
        bodyLength: rawBody.length,
        bodyPreview: rawBody.substring(0, 200),
        // W development pokaż więcej szczegółów
        ...(process.env.NODE_ENV === "development" ? {
          expectedSignature: cleanedExpected,
          receivedSignature: cleanedReceived,
          rawBody: rawBody,
        } : {}),
      });
    } else {
      console.log("[Paynow Webhook] ✓ Signature verified successfully");
    }
    
    return isValid;
  } catch (error) {
    console.error("[Paynow Webhook] Error during signature verification:", error);
    return false;
  }
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

  // Weryfikuj sygnaturę - jeśli nie jest poprawna, odrzuć webhook
  // WAŻNE: Zgodnie z dokumentacją Paynow, webhooki mogą być wysyłane wielokrotnie,
  // więc musimy zawsze zwracać 200 OK, nawet jeśli sygnatura jest niepoprawna
  // (aby Paynow nie próbowało ponownie wysłać tego samego webhooka w nieskończoność)
  const isValidSignature = verifySignature(rawBody, signature);
  if (!isValidSignature) {
    console.error("[Paynow Webhook] ❌ Invalid signature - webhook rejected", {
      hasSignature: !!signature,
      signatureLength: signature?.length || 0,
      bodyLength: rawBody.length,
      bodyPreview: rawBody.substring(0, 200),
      timestamp: new Date().toISOString(),
    });
    // Zwróć 200 OK z pustym body zgodnie z dokumentacją Paynow
    // (jeśli sygnatura jest niepoprawna, problem jest po naszej stronie, ale nie chcemy
    // aby Paynow próbowało ponownie wysłać ten sam webhook)
    return new NextResponse(null, { status: 200 });
  }

  let payload: PaynowWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaynowWebhookPayload;
    console.log("[Paynow Webhook] Parsed payload:", {
      paymentId: payload.paymentId,
      externalId: payload.externalId,
      status: payload.status,
      modifiedAt: payload.modifiedAt,
      amount: payload.amount,
    });
  } catch (error) {
    console.error("[Paynow Webhook] Failed to parse webhook payload:", error, rawBody);
    // Zwróć 200 OK z pustym body nawet gdy payload jest niepoprawny,
    // aby Paynow nie próbowało ponownie wysłać tego samego webhooka
    // (jeśli payload jest niepoprawny, problem jest po naszej stronie)
    return new NextResponse(null, { status: 200 });
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
    // Zwróć 200 OK z pustym body nawet gdy booking nie został znaleziony,
    // aby Paynow nie próbowało ponownie wysłać tego samego webhooka
    // (problem jest po naszej stronie - booking może nie istnieć lub externalId jest niepoprawne)
    return new NextResponse(null, { status: 200 });
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
      console.log(`[Paynow Webhook] Processing CONFIRMED payment for booking ${payload.externalId}, payment ${payload.paymentId}`);
      break;
    case "PENDING":
      // Płatność oczekująca - nie zmieniamy statusu, ale logujemy
      console.log(`[Paynow Webhook] Payment ${payload.paymentId} is pending for booking ${payload.externalId}`);
      // Zwróć 200 OK z pustym body zgodnie z dokumentacją Paynow
      return new NextResponse(null, { status: 200 });
    case "REJECTED":
      // Płatność odrzucona - nie zmieniamy statusu
      console.log(`[Paynow Webhook] Payment ${payload.paymentId} was rejected for booking ${payload.externalId}`);
      // Zwróć 200 OK z pustym body zgodnie z dokumentacją Paynow
      return new NextResponse(null, { status: 200 });
    case "EXPIRED":
      // Płatność wygasła - nie zmieniamy statusu
      console.log(`[Paynow Webhook] Payment ${payload.paymentId} expired for booking ${payload.externalId}`);
      // Zwróć 200 OK z pustym body zgodnie z dokumentacją Paynow
      return new NextResponse(null, { status: 200 });
    default:
      // Dla innych statusów nie zmieniamy nic
      console.log(`[Paynow Webhook] Unknown payment status: ${status} for payment ${payload.paymentId}`);
      // Zwróć 200 OK z pustym body zgodnie z dokumentacją Paynow
      return new NextResponse(null, { status: 200 });
  }

  // Zapisz wpis w historii płatności tylko dla potwierdzonych płatności
  // Sprawdź czy wpis już istnieje, aby uniknąć duplikatów
  // Używamy admin clienta, aby ominąć RLS i mieć pewność, że operacja się powiedzie
  let paymentHistoryInserted = false;
  if (shouldUpdatePaymentHistory && amountCents > 0) {
    console.log(`[Paynow Webhook] Checking for existing payment history entry for payment ${payload.paymentId}...`);
    
    // Sprawdź czy wpis już istnieje dla tego paymentId
    // NIE używamy .single() bo zwróci błąd gdy nie ma wpisu
    // Używamy admin clienta, aby ominąć RLS
    const { data: existingHistory, error: checkError } = await supabase
      .from("payment_history")
      .select("id, notes, amount_cents")
      .eq("booking_id", booking.id)
      .like("notes", `%${payload.paymentId}%`)
      .limit(1);

    if (checkError) {
      console.error(`[Paynow Webhook] Error checking existing payment history:`, {
        error: checkError,
        errorCode: checkError.code,
        errorMessage: checkError.message,
        bookingId: booking.id,
        paymentId: payload.paymentId,
      });
      // Kontynuuj mimo błędu - spróbuj dodać wpis
    }

    // Jeśli nie ma wpisu (brak danych lub pusta tablica), dodaj nowy wpis
    if (!existingHistory || existingHistory.length === 0) {
      console.log(`[Paynow Webhook] No existing payment history found for payment ${payload.paymentId}, inserting new entry...`);
      console.log(`[Paynow Webhook] Insert data: booking_id=${booking.id}, amount_cents=${amountCents}, payment_method=paynow`);
      
      // Spróbuj dodać wpis - użyj retry logic jeśli potrzeba
      let retries = 3;
      let insertSuccess = false;
      
      while (retries > 0 && !insertSuccess) {
        const { error: historyError, data: insertedHistory } = await supabase
          .from("payment_history")
          .insert({
            booking_id: booking.id,
            amount_cents: amountCents,
            payment_method: "paynow",
            notes: `Paynow payment ${payload.paymentId} - status: ${status}`,
          })
          .select();

        if (historyError) {
          console.error(`[Paynow Webhook] ❌ Failed to insert payment history (attempt ${4 - retries}/3):`, {
            error: historyError,
            errorCode: historyError.code,
            errorMessage: historyError.message,
            errorDetails: historyError.details,
            errorHint: historyError.hint,
            bookingId: booking.id,
            paymentId: payload.paymentId,
            amountCents: amountCents,
          });
          
          retries--;
          if (retries > 0) {
            // Poczekaj chwilę przed ponowną próbą
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          insertSuccess = true;
          paymentHistoryInserted = true;
          console.log(`[Paynow Webhook] ✓ Successfully inserted payment history entry for payment ${payload.paymentId}:`, insertedHistory);
        }
      }
      
      if (!insertSuccess) {
        console.error(`[Paynow Webhook] ⚠️ CRITICAL: Failed to insert payment history after 3 attempts. Payment ${payload.paymentId} may not be recorded in payment_history!`);
      }
    } else {
      paymentHistoryInserted = true; // Wpis już istnieje
      console.log(`[Paynow Webhook] Payment history entry already exists for payment ${payload.paymentId} (id: ${existingHistory[0].id}, amount: ${existingHistory[0].amount_cents}), skipping insert`);
    }
  } else {
    console.log(`[Paynow Webhook] Skipping payment history insert - shouldUpdatePaymentHistory=${shouldUpdatePaymentHistory}, amountCents=${amountCents}`);
  }

  // Aktualizuj status płatności i status rezerwacji w rezerwacji
  // WAŻNE: Ta aktualizacja musi być wykonana niezależnie od tego, czy payment_history zostało dodane
  console.log(`[Paynow Webhook] Updating booking ${booking.id} (${payload.externalId}) payment status from ${booking.payment_status} to ${newPaymentStatus}`);
  console.log(`[Paynow Webhook] Payment details: paymentId=${payload.paymentId}, status=${status}, amount=${amountCents} cents, paymentHistoryInserted=${paymentHistoryInserted}`);
  
  // Przygotuj obiekt aktualizacji - jeśli płatność jest potwierdzona, ustaw również status rezerwacji na "confirmed"
  const updateData: { payment_status: string; status?: string } = { payment_status: newPaymentStatus };
  if (status === "CONFIRMED") {
    // Aktualizuj status rezerwacji na "confirmed" gdy płatność jest potwierdzona
    updateData.status = "confirmed";
    console.log(`[Paynow Webhook] Also updating booking status to "confirmed"`);
  }
  
  // Dla potwierdzonych płatności ZAWSZE aktualizuj status, nawet jeśli już jest "paid"
  // To zapewnia, że status jest zawsze poprawny, nawet jeśli webhook był wywołany wielokrotnie
  if (status === "CONFIRMED") {
    console.log(`[Paynow Webhook] CONFIRMED payment - forcing update to ensure status is correct`);
    console.log(`[Paynow Webhook] Current status: ${booking.payment_status}, Target status: ${newPaymentStatus}`);
    
    // Użyj retry logic dla aktualizacji statusu
    let updateRetries = 3;
    let updateSuccess = false;
    
    while (updateRetries > 0 && !updateSuccess) {
      const { error: updateError, data: updatedBooking } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", booking.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[Paynow Webhook] Failed to update booking payment status (attempt ${4 - updateRetries}/3):`, {
          bookingId: booking.id,
          bookingRef: payload.externalId,
          error: updateError,
          errorCode: updateError.code,
          errorMessage: updateError.message,
          errorDetails: updateError.details,
          attemptedStatus: newPaymentStatus,
          updateData: updateData,
        });
        
        updateRetries--;
        if (updateRetries > 0) {
          // Poczekaj chwilę przed ponowną próbą
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } else {
        updateSuccess = true;
        console.log(`[Paynow Webhook] ✓ Successfully updated booking ${booking.id} payment status from ${booking.payment_status} to ${newPaymentStatus}`, {
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
        
        if (verifyBooking) {
          console.log(`[Paynow Webhook] Verification - booking ${booking.id} now has payment_status=${verifyBooking.payment_status}, status=${verifyBooking.status}`);
          
          // Jeśli weryfikacja pokazuje, że status nie został zaktualizowany, loguj to jako błąd
          if (verifyBooking.payment_status !== newPaymentStatus) {
            console.error(`[Paynow Webhook] ⚠️ VERIFICATION FAILED - Expected payment_status=${newPaymentStatus}, but got ${verifyBooking.payment_status}`);
          } else {
            console.log(`[Paynow Webhook] ✓ Verification successful - status correctly updated to ${newPaymentStatus}`);
          }
        } else {
          console.error(`[Paynow Webhook] ⚠️ Verification failed - could not fetch updated booking`);
        }
      }
    }
    
    if (!updateSuccess) {
      console.error(`[Paynow Webhook] ⚠️ CRITICAL: Failed to update booking payment status after 3 attempts. Payment ${payload.paymentId} may not be reflected in booking status!`);
      // Nie zwracaj błędu - webhook został już przetworzony, ale status nie został zaktualizowany
      // Paynow nie powinno ponownie wysyłać tego samego webhooka
    }
  } else {
    // Dla innych statusów sprawdź czy aktualizacja jest potrzebna
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
        // Nie zwracaj błędu - kontynuuj przetwarzanie
      } else {
        console.log(`[Paynow Webhook] Successfully updated booking ${booking.id} payment status to ${newPaymentStatus}`, {
          bookingId: booking.id,
          bookingRef: payload.externalId,
          oldStatus: booking.payment_status,
          newStatus: newPaymentStatus,
          updatedBooking: updatedBooking,
        });
      }
    }
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

  // Zgodnie z dokumentacją Paynow: "After sending a notification Paynow system requires 
  // an HTTP response with a 200 OK or 202 Accepted status (with the empty body)."
  // Zwracamy 200 OK z pustym body, aby Paynow wiedziało, że webhook został poprawnie przetworzony
  return new NextResponse(null, { status: 200 });
}


