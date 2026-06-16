import { processPaymentInvoice } from "@/lib/invoices/invoice-service";

type CreateInvoiceForPaynowPaymentParams = {
  bookingId: string;
  paymentHistoryId: string;
  amountCents: number;
  logPrefix?: string;
  scheduleAfterResponse?: (task: Promise<void>) => void;
};

/**
 * Wystawia fakturę zaliczkową po potwierdzonej wpłacie Paynow.
 * Idempotentne — processPaymentInvoice pomija duplikaty dla tego samego payment_history_id.
 */
export async function createInvoiceForPaynowPayment(
  params: CreateInvoiceForPaynowPaymentParams
) {
  const {
    bookingId,
    paymentHistoryId,
    amountCents,
    logPrefix = "[Paynow]",
    scheduleAfterResponse,
  } = params;

  if (!paymentHistoryId || amountCents <= 0) {
    console.log(`${logPrefix} Skipping invoice — brak payment_history lub kwoty`);
    return null;
  }

  console.log(
    `${logPrefix} Creating advance invoice for booking ${bookingId}, payment_history ${paymentHistoryId}`
  );

  const result = await processPaymentInvoice({
    bookingId,
    paymentHistoryId,
    amountCents,
    scheduleAfterResponse:
      scheduleAfterResponse ??
      ((task) => {
        task.catch((err) => {
          console.error(`${logPrefix} Invoice background task failed:`, err);
        });
      }),
  });

  if (result.success) {
    console.log(`${logPrefix} ✓ Invoice created:`, {
      invoiceId: result.invoiceId,
      invoiceNumber: result.invoiceNumber,
      providerInvoiceId: result.providerInvoiceId,
    });
  } else {
    console.error(`${logPrefix} Failed to create invoice:`, result.error);
  }

  return result;
}
