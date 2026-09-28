/**
 * Czy wpis payment_history powinien liczyć się do sumy wpłaconych środków.
 * Wpis Paynow ze statusem PENDING/NEW (zainicjowana bramka, bez CONFIRMED)
 * trzyma tylko paymentId — nie wolno go doliczać do paid_amount.
 */
export function countsTowardPaidAmount(entry: {
  payment_method?: string | null;
  notes?: string | null;
  amount_cents?: number | null;
}): boolean {
  const method = (entry.payment_method ?? "").toLowerCase().trim();
  const notes = entry.notes ?? "";
  const isPaynow = method === "paynow" || /paynow payment/i.test(notes);

  if (!isPaynow) return true;

  // Jawne potwierdzenie
  if (/status:\s*CONFIRMED/i.test(notes)) return true;

  // Zainicjowana / oczekująca / odrzucona — nie liczyć
  if (/status:\s*(PENDING|NEW|WAITING|REJECTED|EXPIRED|ABANDONED|ERROR)/i.test(notes)) {
    return false;
  }

  // Paynow bez statusu w notatkach — ostrożnie: nie licz (unikaj false paid)
  if (/paynow payment/i.test(notes) && !/status:\s*\w+/i.test(notes)) {
    return false;
  }

  return true;
}
