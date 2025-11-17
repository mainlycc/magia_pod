export const PAYMENT_STATUS_VALUES = ["unpaid", "partial", "paid", "overpaid"] as const;

export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_STATUS_OPTIONS: ReadonlyArray<{
  value: PaymentStatusValue;
  label: string;
}> = [
  { value: "unpaid", label: "Nieopłacona" },
  { value: "partial", label: "Częściowa" },
  { value: "paid", label: "Opłacona" },
  { value: "overpaid", label: "Nadpłata" },
] as const;

const BADGE_STYLES: Record<PaymentStatusValue, string> = {
  unpaid: "border-destructive/40 bg-destructive/10 text-destructive",
  partial: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  overpaid: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function getPaymentStatusLabel(status: string | null | undefined) {
  if (!status) return "Nieznany";
  const option = PAYMENT_STATUS_OPTIONS.find((item) => item.value === status);
  return option ? option.label : "Nieznany";
}

export function getPaymentStatusBadgeClass(status: PaymentStatusValue) {
  return BADGE_STYLES[status] ?? "";
}

