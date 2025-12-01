export interface PaymentRecord {
  amount_cents: number;
  payment_date: string;
}

export interface PaymentSummary {
  totalPaid: number;
  totalDue: number;
  balance: number;
  isOverpaid: boolean;
  isFullyPaid: boolean;
}

/**
 * Oblicza saldo płatności dla rezerwacji
 */
export function calculatePaymentBalance(
  tripPriceCents: number,
  payments: PaymentRecord[]
): PaymentSummary {
  const totalPaid = payments.reduce(
    (sum, payment) => sum + (payment.amount_cents || 0),
    0
  );
  const totalDue = tripPriceCents || 0;
  const balance = totalDue - totalPaid;
  const isOverpaid = totalPaid > totalDue;
  const isFullyPaid = totalPaid >= totalDue;

  return {
    totalPaid,
    totalDue,
    balance,
    isOverpaid,
    isFullyPaid,
  };
}

/**
 * Generuje plan płatności (domyślny: 50% zaliczka, 50% przed wyjazdem)
 */
export function generatePaymentPlan(
  tripPriceCents: number,
  tripStartDate: string | null
): Array<{ dueDate: string; amountCents: number; label: string }> {
  if (!tripPriceCents || tripPriceCents === 0) {
    return [];
  }

  const plan = [];
  const halfAmount = Math.round(tripPriceCents / 2);

  // Zaliczka - 7 dni po rezerwacji
  const depositDate = new Date();
  depositDate.setDate(depositDate.getDate() + 7);
  plan.push({
    dueDate: depositDate.toISOString().split("T")[0],
    amountCents: halfAmount,
    label: "Zaliczka (50%)",
  });

  // Reszta - 14 dni przed wyjazdem
  if (tripStartDate) {
    const finalDate = new Date(tripStartDate);
    finalDate.setDate(finalDate.getDate() - 14);
    plan.push({
      dueDate: finalDate.toISOString().split("T")[0],
      amountCents: tripPriceCents - halfAmount,
      label: "Pozostała kwota (50%)",
    });
  } else {
    plan.push({
      dueDate: depositDate.toISOString().split("T")[0],
      amountCents: tripPriceCents - halfAmount,
      label: "Pozostała kwota (50%)",
    });
  }

  return plan;
}

