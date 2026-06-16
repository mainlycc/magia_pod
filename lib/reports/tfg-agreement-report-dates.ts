import { TZDate } from "@date-fns/tz";

export const REPORT_TIMEZONE = "Europe/Warsaw";

const PAID_PAYMENT_STATUSES = new Set(["paid", "partial", "overpaid"]);

function zonedInstantIso(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
  ms: number,
): string {
  const d = new TZDate(year, monthIndex, day, hours, minutes, seconds, ms, REPORT_TIMEZONE);
  return new Date(d.getTime()).toISOString();
}

export function resolvePeriodBounds(
  period: "month" | "range",
  opts: { year?: number; month?: number; dateFrom?: string; dateTo?: string },
): { startIso: string; endIso: string } {
  if (period === "month") {
    const y = opts.year!;
    const m = opts.month!;
    const startIso = zonedInstantIso(y, m - 1, 1, 0, 0, 0, 0);
    const endIso = zonedInstantIso(y, m, 0, 23, 59, 59, 999);
    return { startIso, endIso };
  }

  const [fromY, fromM, fromD] = opts.dateFrom!.split("-").map(Number);
  const [toY, toM, toD] = opts.dateTo!.split("-").map(Number);
  const startIso = zonedInstantIso(fromY, fromM - 1, fromD, 0, 0, 0, 0);
  const endIso = zonedInstantIso(toY, toM - 1, toD, 23, 59, 59, 999);
  return { startIso, endIso };
}

export function getAgreementConclusionDate(agreement: {
  signed_at: string | null;
  generated_at: string;
}): string {
  return agreement.signed_at ?? agreement.generated_at;
}

export function isEffectiveDateInRange(
  conclusionIso: string,
  startIso: string,
  endIso: string,
): boolean {
  const t = Date.parse(conclusionIso);
  return t >= Date.parse(startIso) && t <= Date.parse(endIso);
}

export function isConcludedAgreement(
  agreement: { status: string },
  booking: { status: string; payment_status: string | null },
): boolean {
  if (booking.status === "cancelled") return false;
  if (agreement.status === "signed") return true;
  return PAID_PAYMENT_STATUSES.has(booking.payment_status ?? "");
}
