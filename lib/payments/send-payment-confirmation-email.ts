import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  buildPaymentConfirmedEmailHtml,
  buildPaymentConfirmedEmailText,
} from "@/lib/email/templates/payment-confirmed";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

type SendPaymentConfirmationEmailParams = {
  supabase: SupabaseClient;
  paymentHistoryId: string;
  contactEmail: string;
  publicAgreementNumber: string;
  accessToken: string | null;
  bookingRef: string;
  agreementAttachment?: { filename: string; base64: string };
  origin?: string;
};

/**
 * Wysyła mail potwierdzający płatność — max raz na wpis payment_history.
 * Paynow wysyła webhook wielokrotnie; deduplikacja przez payment_confirmation_sent_at.
 */
export async function sendPaymentConfirmationEmail(
  params: SendPaymentConfirmationEmailParams,
): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  const {
    supabase,
    paymentHistoryId,
    contactEmail,
    publicAgreementNumber,
    accessToken,
    bookingRef,
    agreementAttachment,
    origin,
  } = params;

  const { data: claimed, error: claimError } = await supabase
    .from("payment_history")
    .update({ payment_confirmation_sent_at: new Date().toISOString() })
    .eq("id", paymentHistoryId)
    .is("payment_confirmation_sent_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    // Kolumna może jeszcze nie istnieć przed migracją — loguj i kontynuuj bez deduplikacji
    if (claimError.message?.includes("payment_confirmation_sent_at")) {
      console.warn(
        "[PaymentConfirmation] Brak kolumny payment_confirmation_sent_at — uruchom migrację 054. Wysyłka bez deduplikacji.",
      );
    } else {
      console.error("[PaymentConfirmation] Nie udało się zarezerwować wysyłki:", claimError);
      return { sent: false, error: claimError.message };
    }
  } else if (!claimed) {
    console.log(
      `[PaymentConfirmation] Mail już wysłany dla payment_history ${paymentHistoryId} — pomijam`,
    );
    return { sent: false, skipped: true };
  }

  const baseUrl = resolvePublicBaseUrl(origin);
  const successUrl = accessToken
    ? `${baseUrl}/payments/success?token=${accessToken}&booking_ref=${bookingRef}`
    : `${baseUrl}/payments/success?booking_ref=${bookingRef}`;

  const displayNumber = publicAgreementNumber || "—";
  const hasAgreementAttachment = Boolean(agreementAttachment);

  const sendResult = await sendTransactionalEmail({
    to: contactEmail,
    subject: `Płatność potwierdzona dla umowy ${displayNumber}`,
    html: buildPaymentConfirmedEmailHtml({
      publicAgreementNumber: displayNumber,
      successUrl,
      hasAgreementAttachment,
    }),
    text: buildPaymentConfirmedEmailText({
      publicAgreementNumber: displayNumber,
      successUrl,
      hasAgreementAttachment,
    }),
    attachment: agreementAttachment
      ? { filename: agreementAttachment.filename, base64: agreementAttachment.base64 }
      : undefined,
    logContext: "payment-confirmed",
  });

  if (!sendResult.ok) {
    // Cofnij rezerwację, żeby kolejny webhook mógł ponowić wysyłkę
    await supabase
      .from("payment_history")
      .update({ payment_confirmation_sent_at: null })
      .eq("id", paymentHistoryId);

    console.error("[PaymentConfirmation] Błąd wysyłki maila:", sendResult.error);
    return { sent: false, error: sendResult.error };
  }

  console.log("[PaymentConfirmation] ✓ Mail wysłany:", {
    paymentHistoryId,
    to: contactEmail,
    hasAgreementAttachment,
  });

  return { sent: true };
}
