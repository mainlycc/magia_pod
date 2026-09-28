/**
 * Wyciąga Paynow paymentId z notatek payment_history.
 * Typowy format: "Paynow payment {id} - status: CONFIRMED ..."
 */
export function extractPaynowPaymentIdFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  const patterns = [
    /Paynow payment ([A-Za-z0-9-]+)/i,
    /payment[:\s]+([A-Za-z0-9-]+)/i,
    /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
  ];

  for (const pattern of patterns) {
    const match = notes.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Notatka wpisu Paynow ze statusem CONFIRMED. Wpis z init ma „status: PENDING” —
 * bez podmiany countsTowardPaidAmount go pomija i przeliczenie zeruje wpłatę.
 */
export function withPaynowStatusConfirmed(notes: string | null | undefined): string {
  const current = notes ?? "";
  if (/status:\s*CONFIRMED/i.test(current)) return current;
  if (/status:\s*\w+/i.test(current)) return current.replace(/status:\s*\w+/i, "status: CONFIRMED");
  return `${current} - status: CONFIRMED`.replace(/^ - /, "");
}

export function isPaynowHistoryEntry(entry: {
  payment_method?: string | null;
  notes?: string | null;
}): boolean {
  const method = (entry.payment_method ?? "").toLowerCase().trim();
  if (method === "paynow") return true;
  return /paynow payment/i.test(entry.notes ?? "");
}
