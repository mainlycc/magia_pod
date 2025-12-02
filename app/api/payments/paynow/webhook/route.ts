import crypto from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type PaynowWebhookPayload = {
  paymentId: string;
  externalId: string;
  status: string;
  amount: {
    value: number;
    currency: string;
  };
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
  const expected = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
  return expected === signatureHeader;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let payload: PaynowWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PaynowWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, trip_id, contact_email")
    .eq("booking_ref", payload.externalId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }

  const isSuccess = ["CONFIRMED", "COMPLETED", "PAID"].includes(
    payload.status.toUpperCase(),
  );

  if (!isSuccess) {
    // Dla nieudanych/oczekujących płatności na razie nie zmieniamy statusu
    return NextResponse.json({ ok: true });
  }

  const amountCents = payload.amount?.value ?? 0;

  // Zapisz wpis w historii płatności
  if (amountCents > 0) {
    await supabase.from("payment_history").insert({
      booking_id: booking.id,
      amount_cents: amountCents,
      payment_method: "paynow",
      notes: `Paynow payment ${payload.paymentId}`,
    });
  }

  // Oznacz rezerwację jako opłaconą
  await supabase
    .from("bookings")
    .update({ payment_status: "paid" })
    .eq("id", booking.id);

  // Wyślij mail potwierdzający opłacenie rezerwacji
  if (booking.contact_email) {
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


