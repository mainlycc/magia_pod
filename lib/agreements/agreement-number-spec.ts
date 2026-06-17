/**
 * Konwencja numeru umowy / publicznego numeru rezerwacji
 * ======================================================
 *
 * W systemie Magia Podróżowania terminy „numer umowy” i publiczny „numer rezerwacji”
 * oznaczają to samo — identyfikator złożony z dwóch części:
 *
 * 1. **Numer wycieczki** (`trips.reservation_number`)
 *    Ręcznie nadany kod wyjazdu (np. `123456`). Jeden numer na całą wycieczkę.
 *
 * 2. **Numer kolejny umowy** (`agreements.agreement_seq`)
 *    Kolejność zawarcia umów na danej wycieczce: 1, 2, 3…
 *    Przyznawany globalnie dla wszystkich rezerwacji tej wycieczki (nie per booking).
 *
 * Format publiczny: `AAAAAA/BBB` — np. `123456/001`
 * Format wewnętrzny (z prefiksem #): `#123456/001`
 *
 * To NIE jest:
 * - `bookings.booking_ref` — wewnętrzny identyfikator płatności PayNow
 * - `bookings.id` — identyfikator techniczny rezerwacji w bazie
 *
 * Źródła danych w bazie:
 * - numer wycieczki → `trips.reservation_number`
 * - kolejność umowy → `agreements.agreement_seq` (przydzielany przez `getNextAgreementSeq`)
 */

/** Składniki publicznego numeru umowy / rezerwacji. */
export type AgreementNumberParts = {
  /** `trips.reservation_number` — numer wycieczki */
  tripNumber?: string | null;
  /** `agreements.agreement_seq` — kolejny numer umowy na wycieczce */
  agreementSeq?: number | null;
};

/** Alias zachowany dla kompatybilności z istniejącym kodem. */
export type AgreementNumberInput = AgreementNumberParts & {
  /** @deprecated Użyj `tripNumber` — to samo pole co `trips.reservation_number` */
  reservationNumber?: string | null;
};

export const AGREEMENT_NUMBER_SPEC = {
  /** Separator między numerem wycieczki a numerem kolejnym umowy */
  separator: "/",
  /** Minimalna szerokość numeru wycieczki (z zerami wiodącymi) */
  tripNumberPadLength: 6,
  /** Minimalna szerokość numeru kolejnego umowy (z zerami wiodącymi) */
  agreementSeqPadLength: 3,
  /** Wartość zwracana, gdy brak ważnego `agreement_seq` */
  missingValue: "-",
  /** Wartość wyświetlana w UI, gdy numer nie jest dostępny */
  missingDisplay: "—",
} as const;

function normalizeTripNumber(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^#+/, "");
}

function resolveParts(input: AgreementNumberInput): AgreementNumberParts {
  return {
    tripNumber: input.tripNumber ?? input.reservationNumber ?? null,
    agreementSeq: input.agreementSeq ?? null,
  };
}

/** Zwraca najwyższy `agreement_seq` z listy rekordów agreements. */
export function getLatestAgreementSeq(
  agreements:
    | { agreement_seq?: number | null }
    | Array<{ agreement_seq?: number | null }>
    | null
    | undefined,
): number | null {
  const list = Array.isArray(agreements) ? agreements : agreements ? [agreements] : [];
  const seqs = list.map((a) => a?.agreement_seq ?? 0).filter((n) => n > 0);
  if (seqs.length === 0) return null;
  return Math.max(...seqs);
}

/**
 * Formatuje publiczny numer umowy / rezerwacji.
 * Zwraca `#AAAAAA/BBB` lub `#BBB` gdy brak numeru wycieczki, albo `-` gdy brak `agreement_seq`.
 */
export function formatAgreementNumber(input: AgreementNumberInput): string {
  const { tripNumber, agreementSeq } = resolveParts(input);
  const trip = normalizeTripNumber(tripNumber);
  const seq = agreementSeq ?? null;

  if (!seq || seq <= 0) return AGREEMENT_NUMBER_SPEC.missingValue;

  if (!trip) {
    return `#${String(seq).padStart(AGREEMENT_NUMBER_SPEC.agreementSeqPadLength, "0")}`;
  }

  return `#${trip.padStart(AGREEMENT_NUMBER_SPEC.tripNumberPadLength, "0")}${AGREEMENT_NUMBER_SPEC.separator}${String(seq).padStart(AGREEMENT_NUMBER_SPEC.agreementSeqPadLength, "0")}`;
}

/** Jak `formatAgreementNumber`, ale bez wiodącego `#` — do wyświetlania klientowi i w tabelach. */
export function formatPublicAgreementNumber(input: AgreementNumberInput): string {
  return formatAgreementNumber(input).replace(/^#/, "");
}

/** Parsuje publiczny numer w formacie `AAAAAA/BBB` lub `#AAAAAA/BBB`. */
export function parsePublicAgreementNumber(
  value: string | null | undefined,
): AgreementNumberParts | null {
  const raw = (value ?? "").trim().replace(/^#+/, "");
  if (!raw || raw === AGREEMENT_NUMBER_SPEC.missingValue) return null;

  const slashIdx = raw.indexOf(AGREEMENT_NUMBER_SPEC.separator);
  if (slashIdx === -1) {
    const seq = parseInt(raw, 10);
    return Number.isFinite(seq) && seq > 0 ? { tripNumber: null, agreementSeq: seq } : null;
  }

  const tripNumber = raw.slice(0, slashIdx).trim();
  const seq = parseInt(raw.slice(slashIdx + 1), 10);
  if (!Number.isFinite(seq) || seq <= 0) return null;

  return {
    tripNumber: tripNumber || null,
    agreementSeq: seq,
  };
}

type BookingAgreementSource = {
  agreements?: { agreement_seq?: number | null } | Array<{ agreement_seq?: number | null }> | null;
  trips?:
    | { reservation_number?: string | null }
    | Array<{ reservation_number?: string | null }>
    | null;
};

/**
 * Buduje numer umowy z joinu `bookings → trips + agreements`.
 * Używaj zamiast `booking_ref` wszędzie, gdzie potrzebny jest publiczny identyfikator.
 */
export function formatAgreementNumberFromBooking(
  booking: BookingAgreementSource | BookingAgreementSource[] | null | undefined,
): string {
  const b = Array.isArray(booking) ? booking[0] : booking;
  if (!b) return AGREEMENT_NUMBER_SPEC.missingDisplay;

  const trip = Array.isArray(b.trips) ? b.trips[0] : b.trips;
  const formatted = formatPublicAgreementNumber({
    tripNumber: trip?.reservation_number ?? null,
    agreementSeq: getLatestAgreementSeq(b.agreements),
  });

  return formatted === AGREEMENT_NUMBER_SPEC.missingValue
    ? AGREEMENT_NUMBER_SPEC.missingDisplay
    : formatted;
}
