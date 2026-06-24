import {
  sumAdditionalServicesCents,
  type ParticipantLike,
} from "@/lib/sum-additional-services-cents";

export interface PaymentRecord {
  amount_cents: number;
  payment_date: string;
}

export type PaymentScheduleEntry = {
  installment_number?: number;
  percent: number;
};

export type TripPaymentConfig = {
  payment_split_enabled?: boolean | null;
  payment_split_first_percent?: number | null;
  payment_split_second_percent?: number | null;
  payment_schedule?: PaymentScheduleEntry[] | null;
};

/** Kwota rezerwacji: cena za osobę × liczba osób + dopłaty za usługi dodatkowe. */
export function calculateBookingTotalCents(
  unitPriceCents: number,
  participantsCount: number,
  participants?: readonly ParticipantLike[],
): number {
  const base = Math.max(0, unitPriceCents || 0) * Math.max(0, participantsCount);
  const addons =
    participants && participants.length > 0
      ? sumAdditionalServicesCents(participants)
      : 0;
  return base + addons;
}

/** Procent pierwszej raty / zaliczki z harmonogramu lub ustawień wycieczki. */
export function getFirstInstallmentPercent(config: TripPaymentConfig): number {
  if (config.payment_schedule && config.payment_schedule.length > 0) {
    return config.payment_schedule[0].percent;
  }
  if (config.payment_split_enabled === false) {
    return 100;
  }
  return config.payment_split_first_percent ?? 30;
}

export function calculateInstallmentAmounts(
  totalCents: number,
  config: TripPaymentConfig,
): {
  firstPaymentCents: number;
  secondPaymentCents: number;
  firstPercent: number;
} {
  const paymentSchedule =
    config.payment_schedule && config.payment_schedule.length > 0
      ? config.payment_schedule
      : null;

  if (paymentSchedule) {
    const firstPercent = paymentSchedule[0].percent;
    const firstPaymentCents = Math.round((totalCents * firstPercent) / 100);
    const secondPaymentCents =
      paymentSchedule.length > 1
        ? Math.round((totalCents * paymentSchedule[1].percent) / 100)
        : 0;
    return { firstPaymentCents, secondPaymentCents, firstPercent };
  }

  const paymentSplitEnabled = config.payment_split_enabled ?? true;
  const firstPercent = config.payment_split_first_percent ?? 30;

  if (paymentSplitEnabled) {
    const firstPaymentCents = Math.round((totalCents * firstPercent) / 100);
    return {
      firstPaymentCents,
      secondPaymentCents: totalCents - firstPaymentCents,
      firstPercent,
    };
  }

  return {
    firstPaymentCents: totalCents,
    secondPaymentCents: 0,
    firstPercent: 100,
  };
}

/**
 * Domyślne terminy wymagalności rat, gdy wycieczka nie ma zapisanego
 * harmonogramu płatności. Spójne z edytorem harmonogramu w zakładce „Informacje”:
 *  - 1. rata (zaliczka): dziś + 7 dni
 *  - ostatnia rata (dopłata): 14 dni przed wyjazdem (lub dziś + 30 dni, gdy brak daty wyjazdu)
 *
 * Dzięki temu na umowie nie pojawia się dwa razy ta sama data, gdy harmonogram
 * nie został jeszcze zapisany na wycieczce.
 * Zwraca daty w formacie ISO (YYYY-MM-DD).
 */
export function getDefaultPaymentDueDates(startDate: string | null): {
  depositDueDate: string;
  finalDueDate: string;
} {
  const depositDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  let finalDueDate: string;
  if (startDate) {
    finalDueDate = new Date(
      new Date(startDate).getTime() - 14 * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .split("T")[0];
  } else {
    finalDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
  }

  return { depositDueDate, finalDueDate };
}

/** Kwota zaliczki w PLN (string z 2 miejscami po przecinku). */
export function formatDepositAmountZloty(
  totalCents: number,
  firstInstallmentPercent: number,
): string {
  return ((totalCents * firstInstallmentPercent) / 10000).toFixed(2);
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

