import type { SupabaseClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  buildPaymentConfirmedEmailSubject,
  INVOICE_EMAIL_ATTACHMENT_FILENAME,
  resolveContactFirstName,
} from "@/lib/email/payment-confirmation-data";
import {
  buildPaymentConfirmedEmailHtml,
  buildPaymentConfirmedEmailText,
} from "@/lib/email/templates/payment-confirmed";

type SendPaymentConfirmationEmailParams = {
  supabase: SupabaseClient;
  paymentHistoryId: string;
  contactEmail: string;
  publicAgreementNumber: string;
  contactFirstName?: string | null;
  tripTitle: string;
  invoiceAttachment?: { filename: string; base64: string };
  invoiceViewUrl?: string | null;
};

/**
 * Wysyła mail potwierdzający płatność z fakturą — max raz na wpis payment_history.
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
    contactFirstName,
    tripTitle,
    invoiceAttachment,
    invoiceViewUrl,
  } = params;

  const { data: claimed, error: claimError } = await supabase
    .from("payment_history")
    .update({ payment_confirmation_sent_at: new Date().toISOString() })
    .eq("id", paymentHistoryId)
    .is("payment_confirmation_sent_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
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

  const displayNumber = publicAgreementNumber || "—";
  const attachmentFilenames = invoiceAttachment
    ? [invoiceAttachment.filename || INVOICE_EMAIL_ATTACHMENT_FILENAME]
    : [];

  const emailParams = {
    agreementNumber: displayNumber,
    contactFirstName: resolveContactFirstName(contactFirstName),
    tripTitle: tripTitle || "Wycieczka",
    attachmentFilenames,
    invoiceViewUrl: invoiceViewUrl ?? null,
  };

  const sendResult = await sendTransactionalEmail({
    to: contactEmail,
    subject: buildPaymentConfirmedEmailSubject({
      agreementNumber: displayNumber,
      tripTitle: emailParams.tripTitle,
    }),
    html: buildPaymentConfirmedEmailHtml(emailParams),
    text: buildPaymentConfirmedEmailText(emailParams),
    attachment: invoiceAttachment
      ? {
          filename: invoiceAttachment.filename || INVOICE_EMAIL_ATTACHMENT_FILENAME,
          base64: invoiceAttachment.base64,
        }
      : undefined,
    logContext: "payment-confirmed",
  });

  if (!sendResult.ok) {
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
    hasInvoiceAttachment: Boolean(invoiceAttachment),
    hasInvoiceViewUrl: Boolean(invoiceViewUrl),
  });

  return { sent: true };
}
