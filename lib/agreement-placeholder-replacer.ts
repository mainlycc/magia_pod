// Funkcja do zastępowania placeholderów danymi z wycieczki (bez danych klienta/rezerwacji)

import type { TripFullData, TripContentData } from "@/contexts/trip-context";
import { formatPostalAddressLine } from "./format-postal-address";
import {
  formatSelectedServicesPerParticipant,
  type ServiceCatalogs,
} from "./resolve-participant-service-titles";
import {
  formatDepositAmountZloty,
  getDefaultPaymentDueDates,
  getFirstInstallmentPercent,
} from "@/lib/utils/payment-calculator";
import {
  resolveAdditionalServicesCents,
  sumAdditionalServicesCents,
  type FormParticipantServiceLike,
} from "@/lib/sum-additional-services-cents";

type RequiredContactFields = {
  pesel?: boolean;
  phone?: boolean;
  email?: boolean;
  address?: boolean;
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
}

function calculateDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "-";
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return `${diffDays} dni`;
  } catch {
    return "-";
  }
}

function calculateNights(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

function formatPlnFromCents(cents: number): string {
  return (Math.max(0, cents || 0) / 100).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildTripPriceBreakdownHtml(params: {
  tripBaseCents: number;
  addonsCents: number;
  totalCents: number;
  depositCents?: number | null;
  firstPercent?: number | null;
}): string {
  const { tripBaseCents, addonsCents, totalCents } = params;
  const firstPercent = params.firstPercent ?? null;
  const depositCents = typeof params.depositCents === "number" ? params.depositCents : null;

  const note =
    addonsCents > 0
      ? `<div style="margin-top: 6px; font-size: 0.75rem; color: #6b7280;">* Cena końcowa zawiera wybrane usługi dodatkowe.</div>`
      : "";

  const depositLine =
    depositCents !== null && firstPercent !== null
      ? `<div style="display:flex; justify-content:space-between; gap:12px; margin-top:10px;">
           <span>Zaliczka (${firstPercent}%)</span>
           <strong style="white-space:nowrap;">${formatPlnFromCents(depositCents)} zł</strong>
         </div>`
      : "";

  return `
<div style="font-size: 0.875rem; line-height: 1.4;">
  <div style="display:flex; justify-content:space-between; gap:12px;">
    <span>Cena wycieczki</span>
    <strong style="white-space:nowrap;">${formatPlnFromCents(tripBaseCents)} zł</strong>
  </div>
  <div style="display:flex; justify-content:space-between; gap:12px;">
    <span>Usługi dodatkowe</span>
    <strong style="white-space:nowrap;">${formatPlnFromCents(addonsCents)} zł</strong>
  </div>
  <div style="border-top: 1px solid #d1d5db; margin: 10px 0;"></div>
  <div style="display:flex; justify-content:space-between; gap:12px;">
    <span><strong>Łączna cena</strong></span>
    <strong style="white-space:nowrap;">${formatPlnFromCents(totalCents)} zł</strong>
  </div>
  ${depositLine}
  ${note}
</div>
  `.trim();
}

/**
 * Wylicza terminy zapłaty zaliczki (pierwsza rata) i całości (ostatnia rata)
 * na podstawie harmonogramu płatności. Jeśli harmonogramu brak — fallback do
 * domyślnych terminów spójnych z zakładką „Informacje” (zaliczka: dziś + 7 dni,
 * dopłata: 14 dni przed wyjazdem), aby na umowie nie pojawiała się dwa razy
 * ta sama data.
 */
function resolvePaymentDeadlines(
  paymentSchedule:
    | Array<{ installment_number?: number; due_date?: string | null }>
    | null
    | undefined,
  startDate: string | null,
): { depositDeadline: string; finalPaymentDeadline: string } {
  const withDates = (paymentSchedule ?? [])
    .filter((item) => item && item.due_date)
    .slice()
    .sort(
      (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
    );

  if (withDates.length > 0) {
    const first = withDates[0];
    const last = withDates[withDates.length - 1];

    return {
      depositDeadline: formatDate(first.due_date ?? null),
      finalPaymentDeadline: formatDate(last.due_date ?? null),
    };
  }

  // Brak harmonogramu — użyj tych samych domyślnych terminów co edytor
  // harmonogramu, żeby umowa zgadzała się z informacjami o wycieczce.
  const { depositDueDate, finalDueDate } = getDefaultPaymentDueDates(startDate);
  return {
    depositDeadline: formatDate(depositDueDate),
    finalPaymentDeadline: formatDate(finalDueDate),
  };
}

/**
 * Zastępuje placeholdery związane z wycieczką danymi z tripFullData i tripContentData
 * Placeholdery związane z klientem/rezerwacją pozostają bez zmian
 */
export function replaceTripPlaceholders(
  html: string,
  tripFullData: TripFullData | null,
  tripContentData: TripContentData | null,
  options?: { insuranceScope?: string | null },
): string {
  if (!tripFullData) return html;

  let result = html;

  // Informacje o wycieczce
  result = result.replace(/\{\{trip_title\}\}/g, tripFullData.title || "-");
  result = result.replace(/\{\{trip_location\}\}/g, tripFullData.location || "-");
  result = result.replace(/\{\{trip_start_date\}\}/g, formatDate(tripFullData.start_date));
  result = result.replace(/\{\{trip_end_date\}\}/g, formatDate(tripFullData.end_date));
  result = result.replace(/\{\{trip_duration\}\}/g, calculateDuration(tripFullData.start_date, tripFullData.end_date));

  // Transport / loty (wprowadzane w "Dodaj wycieczkę")
  result = result.replace(
    /\{\{transport_type\}\}/g,
    (tripFullData.transport_mode ?? "").trim() || "-"
  );
  result = result.replace(
    /\{\{flight_info\}\}/g,
    (tripFullData.airport_codes ?? "").trim() || "-"
  );

  // Backfill dla szablonów, które traktują te pola jako "ręczne"
  // (w praktyce chcemy je wypełniać automatycznie, jeśli mamy dane).
  result = result.replace(/\{\{accommodation_location\}\}/g, tripFullData.location || "-");
  
  // Cena
  const price = tripFullData.price_cents ? (tripFullData.price_cents / 100).toFixed(2) : "-";
  result = result.replace(/\{\{trip_price_per_person\}\}/g, price);
  
  // Numer rezerwacji z tripContentData (jeśli dostępny)
  if (tripContentData?.reservation_number) {
    result = result.replace(/\{\{reservation_number\}\}/g, tripContentData.reservation_number);
  }
  
  // Czas trwania z tripContentData (jeśli dostępny)
  if (tripContentData?.duration_text) {
    result = result.replace(/\{\{trip_duration\}\}/g, tripContentData.duration_text);
  }

  // Terminy płatności: zaliczka = termin pierwszej raty, całość = termin ostatniej raty.
  // Fallback (gdy brak harmonogramu): 14 dni przed wyjazdem.
  const { depositDeadline, finalPaymentDeadline } = resolvePaymentDeadlines(
    tripFullData.payment_schedule,
    tripFullData.start_date,
  );
  result = result.replace(/\{\{trip_deposit_deadline\}\}/g, depositDeadline);
  result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, finalPaymentDeadline);

  // Liczba noclegów
  const nights = calculateNights(tripFullData.start_date, tripFullData.end_date);
  result = result.replace(/\{\{nights_count\}\}/g, nights > 0 ? String(nights) : "-");

  // Dodatkowe świadczenia z tripContentData (additional_service_text ma pierwszeństwo)
  const additionalServicesText =
    tripContentData?.additional_service_text?.trim() ||
    tripContentData?.dodatkowe_swiadczenia?.trim() ||
    "";
  if (additionalServicesText) {
    result = result.replace(/\{\{additional_services\}\}/g, additionalServicesText);
  }

  // Pola umowy z zakładki Umowa (agreement_* w trips)
  result = result.replace(
    /\{\{room_type\}\}/g,
    tripContentData?.agreement_room_type?.trim() || "-",
  );
  result = result.replace(
    /\{\{meals_info\}\}/g,
    tripContentData?.agreement_meals_info?.trim() || "-",
  );
  result = result.replace(
    /\{\{transfer_info\}\}/g,
    tripContentData?.agreement_transfer_info?.trim() || "-",
  );

  const insuranceScope = options?.insuranceScope?.trim();
  if (insuranceScope) {
    result = result.replace(/\{\{insurance_scope\}\}/g, insuranceScope);
  }

  // Informacje o bagażu z tripContentData
  if (tripContentData?.baggage_text) {
    result = result.replace(/\{\{baggage_info\}\}/g, tripContentData.baggage_text);
  }

  // Dodatkowe koszty z tripContentData
  if (tripContentData?.additional_costs_text) {
    result = result.replace(/\{\{additional_costs\}\}/g, tripContentData.additional_costs_text);
  }

  // Cena całkowita (dla przykładu - 1 osoba, bo nie mamy danych o liczbie uczestników)
  result = result.replace(/\{\{trip_total_price\}\}/g, price);
  // Rozpiska ceny (podgląd bez danych rezerwacji: 1 osoba, bez dopłat)
  if (tripFullData.price_cents) {
    const totalCents = tripFullData.price_cents;
    const firstPercent = getFirstInstallmentPercent(tripFullData);
    const depositCents = Math.round((totalCents * firstPercent) / 100);
    result = result.replace(
      /\{\{trip_price_breakdown\}\}/g,
      buildTripPriceBreakdownHtml({
        tripBaseCents: totalCents,
        addonsCents: 0,
        totalCents,
        depositCents,
        firstPercent,
      }),
    );
  } else {
    result = result.replace(/\{\{trip_price_breakdown\}\}/g, "-");
  }

  // Kwota zaliczki (podgląd bez danych rezerwacji — 1 osoba, bez dopłat)
  if (tripFullData.price_cents) {
    const firstPercent = getFirstInstallmentPercent(tripFullData);
    const depositAmount = formatDepositAmountZloty(tripFullData.price_cents, firstPercent);
    result = result.replace(/\{\{trip_deposit_amount\}\}/g, depositAmount);
  } else {
    result = result.replace(/\{\{trip_deposit_amount\}\}/g, "-");
  }

  return result;
}

/**
 * Wiersze generowane dla firmy zanim są znane prawdziwe dane uczestników
 * (patrz mapowanie w booking-form / booking-form-utils).
 */
function isPlaceholderParticipantRow(p: { first_name?: string; last_name?: string }): boolean {
  const last = (p.last_name ?? "").trim();
  if (/\(dane\s+do\s+uzupełnienia\)/i.test(last)) {
    return true;
  }
  const first = (p.first_name ?? "").trim();
  if (/^uczestnik(\s+\d+)?$/i.test(first) && (!last || /\(dane\s+do\s+uzupełnienia\)/i.test(last))) {
    return true;
  }
  return false;
}

/** Rekord bez imienia/nazwiska — np. domyślny pusty uczestnik z defaultValues przy trybie firma */
function hasParticipantNameEntered(p: { first_name?: string; last_name?: string }): boolean {
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  return first.length > 0 && last.length > 0;
}

function removeTableRowsContainingPlaceholder(html: string, placeholderName: string): string {
  // Usuwamy tylko całe wiersze tabeli, żeby nie rozjeżdżać reszty HTML.
  // Działa dla szablonów trzymanych jako HTML string (jak `DEFAULT_AGREEMENT_TEMPLATE_HTML`)
  // oraz dla szablonów z edytora umowy.
  const escaped = placeholderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Ważne: dopasowanie musi zostać w obrębie *jednego* <tr> — inaczej regex może "zjeść"
  // wiele wierszy na raz (od pierwszego <tr> do </tr> po placeholderze).
  const re = new RegExp(
    `<tr\\b[^>]*>(?:(?!<\\/tr>)[\\s\\S])*?\\{\\{${escaped}\\}\\}(?:(?!<\\/tr>)[\\s\\S])*?<\\/tr>`,
    "gi",
  );
  return html.replace(re, "");
}

export function removeCompanySectionFromAgreementHtml(html: string): string {
  let result = html;

  // Usuń nagłówek „Dane firmy” wraz z tabelą zawierającą placeholdery firmy
  result = result.replace(
    /<h2[^>]*>\s*Dane\s+firmy\s*<\/h2>\s*<table\b[^>]*>(?:(?!<\/table>)[\s\S])*?\{\{company_name\}\}(?:(?!<\/table>)[\s\S])*?<\/table>/gi,
    "",
  );

  // Fallback: pojedyncze wiersze (szablony bez nagłówka h2)
  result = removeTableRowsContainingPlaceholder(result, "company_name");
  result = removeTableRowsContainingPlaceholder(result, "company_nip");
  result = removeTableRowsContainingPlaceholder(result, "company_address");

  // Osierocony nagłówek bez tabeli
  result = result.replace(/<h2[^>]*>\s*Dane\s+firmy\s*<\/h2>/gi, "");

  return result;
}

function applyContactFieldVisibilityToAgreementHtml(
  html: string,
  options?: {
    requiredContactFields?: RequiredContactFields | null;
    requirePeselFallback?: boolean | null;
  },
): string {
  const required = options?.requiredContactFields ?? undefined;

  // Uwaga: w formularzu email/phone są domyślnie zbierane, o ile nie ustawiono `false`.
  const collectEmail = required?.email !== false;
  const collectPhone = required?.phone !== false;
  // Adres ma sens tylko gdy jest explicit true
  const collectAddress = Boolean(required?.address);
  // PESEL: zgodnie z formularzem: form_required_contact_fields?.pesel ?? require_pesel
  const collectPesel = Boolean(required?.pesel ?? options?.requirePeselFallback ?? false);

  let result = html;

  if (!collectPesel) {
    result = removeTableRowsContainingPlaceholder(result, "contact_pesel");
  }
  if (!collectPhone) {
    result = removeTableRowsContainingPlaceholder(result, "contact_phone");
  }
  if (!collectEmail) {
    result = removeTableRowsContainingPlaceholder(result, "contact_email");
  }
  if (!collectAddress) {
    result = removeTableRowsContainingPlaceholder(result, "contact_address");
    // Kompatybilność z szablonami rozbitymi na pola:
    result = removeTableRowsContainingPlaceholder(result, "contact_street");
    result = removeTableRowsContainingPlaceholder(result, "contact_city");
    result = removeTableRowsContainingPlaceholder(result, "contact_zip");
  }

  return result;
}

/**
 * Zastępuje placeholdery związane z klientem/rezerwacją danymi z formularza
 */
export function replaceBookingPlaceholders(
  html: string,
  formData: {
    contact?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      pesel?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
    };
    company?: {
      name?: string;
      nip?: string;
      address?: {
        street?: string;
        city?: string;
        zip?: string;
      };
      has_representative?: boolean;
      representative_first_name?: string;
      representative_last_name?: string;
    };
    participants?: Array<{
      first_name?: string;
      last_name?: string;
      selected_services?: unknown;
    }>;
    participants_count?: number;
    participant_services?: Array<
      FormParticipantServiceLike & {
        service_type?: string;
        service_title?: string;
      }
    >;
    service_catalogs?: ServiceCatalogs;
  } | null,
  tripPrice?: number | null,
  tripStartDate?: string | null,
  /** Suma dopłat za usługi dodatkowe (diety, ubezp., atrakcje) w groszach — jak w PDF */
  addonTotalCents?: number | null,
  options?: {
    requiredContactFields?: RequiredContactFields | null;
    /** Fallback do starego `require_pesel` na wycieczce (gdy brak nowej konfiguracji pól). */
    requirePeselFallback?: boolean | null;
    /** Tekst zakresu ubezpieczenia dla {{insurance_scope}} */
    insuranceScope?: string | null;
    /** Procent pierwszej raty / zaliczki (domyślnie 30). */
    firstInstallmentPercent?: number | null;
    /** Harmonogram płatności wycieczki — do wyliczenia terminów rat. */
    paymentSchedule?:
      | Array<{ installment_number?: number; due_date?: string | null }>
      | null;
  },
): string {
  if (!formData) return html;

  let result = applyContactFieldVisibilityToAgreementHtml(html, options);

  if (!formData.company) {
    result = removeCompanySectionFromAgreementHtml(result);
  }

  // Dane zgłaszającego
  const effectiveContactFirstName =
    formData.contact?.first_name ||
    (formData.company?.has_representative ? formData.company?.representative_first_name : undefined) ||
    formData.company?.representative_first_name ||
    undefined;

  const effectiveContactLastName =
    formData.contact?.last_name ||
    (formData.company?.has_representative ? formData.company?.representative_last_name : undefined) ||
    formData.company?.representative_last_name ||
    undefined;

  const contactFullName = [
    effectiveContactFirstName,
    effectiveContactLastName,
  ]
    .filter(Boolean)
    .join(" ") || "-";
  
  const contactAddress = formData.contact?.address
    ? formatPostalAddressLine(formData.contact.address)
    : "-";

  result = result.replace(/\{\{contact_first_name\}\}/g, effectiveContactFirstName || "-");
  result = result.replace(/\{\{contact_last_name\}\}/g, effectiveContactLastName || "-");
  result = result.replace(/\{\{contact_full_name\}\}/g, contactFullName);
  result = result.replace(/\{\{contact_address\}\}/g, contactAddress);
  result = result.replace(/\{\{contact_street\}\}/g, formData.contact?.address?.street || "-");
  result = result.replace(/\{\{contact_city\}\}/g, formData.contact?.address?.city || "-");
  result = result.replace(/\{\{contact_zip\}\}/g, formData.contact?.address?.zip || "-");
  result = result.replace(/\{\{contact_pesel\}\}/g, formData.contact?.pesel || "-");
  result = result.replace(/\{\{contact_phone\}\}/g, formData.contact?.phone || "-");
  result = result.replace(/\{\{contact_email\}\}/g, formData.contact?.email || "-");

  // Dane firmy
  const companyAddress = formData.company?.address
    ? formatPostalAddressLine(formData.company.address)
    : "-";

  result = result.replace(/\{\{company_name\}\}/g, formData.company?.name || "-");
  result = result.replace(/\{\{company_nip\}\}/g, formData.company?.nip || "-");
  result = result.replace(/\{\{company_address\}\}/g, companyAddress);

  // Dane uczestników
  const participantRows = formData.participants ?? [];
  const realParticipants = participantRows.filter(
    (p) => !isPlaceholderParticipantRow(p) && hasParticipantNameEntered(p),
  );
  const hasRealParticipantList = realParticipants.length > 0;

  let participantsCount: number;
  let participantsList: string;

  if (hasRealParticipantList) {
    participantsCount = realParticipants.length;
    participantsList =
      realParticipants
        .map((p) => `${p.first_name || ""} ${p.last_name || ""}`.trim())
        .filter(Boolean)
        .join(", ") || "-";
  } else {
    const fromFormCount =
      typeof formData.participants_count === "number" &&
      Number.isFinite(formData.participants_count) &&
      formData.participants_count > 0
        ? Math.floor(formData.participants_count)
        : 0;
    // Dla osób fizycznych `participants_count` zwykle nie jest ustawiane,
    // a lista uczestników może zawierać jeszcze puste dane — mimo to cena ma liczyć
    // zgodnie z liczbą wierszy uczestników w formularzu.
    participantsCount = fromFormCount > 0 ? fromFormCount : participantRows.length;
    participantsList = "-";
  }

  result = result.replace(/\{\{participants_count\}\}/g, String(participantsCount));
  result = result.replace(/\{\{participants_list\}\}/g, participantsList);

  // Usługi dodatkowe — pogrupowane per uczestnik
  let selectedServicesText = "";
  if (formData.service_catalogs && participantRows.length > 0) {
    selectedServicesText = formatSelectedServicesPerParticipant(
      participantRows.map((p) => ({ selected_services: p.selected_services })),
      formData.service_catalogs,
    );
  } else {
    selectedServicesText =
      formData.participant_services
        ?.map((s) => s.service_title || s.service_type || "")
        .filter(Boolean)
        .join(", ") || "";
    if (!selectedServicesText) selectedServicesText = "brak";
  }

  const selectedServicesHtml = selectedServicesText.replace(/\n/g, "<br>");
  result = result.replace(/\{\{selected_services\}\}/g, selectedServicesHtml || "brak");

  // Zakres ubezpieczenia
  const insuranceScope = options?.insuranceScope?.trim();
  if (insuranceScope) {
    result = result.replace(/\{\{insurance_scope\}\}/g, insuranceScope);
  }

  // Cena całkowita i zaliczka (baza × liczba osób + dopłaty za usługi dodatkowe)
  if (tripPrice && participantsCount > 0) {
    const addon = resolveAdditionalServicesCents(
      participantRows,
      formData.participant_services,
      addonTotalCents,
    );
    const totalCents = tripPrice * participantsCount + addon;
    const totalPrice = (totalCents / 100).toFixed(2);
    const firstPercent = options?.firstInstallmentPercent ?? 30;
    const depositAmount = formatDepositAmountZloty(totalCents, firstPercent);
    result = result.replace(/\{\{trip_total_price\}\}/g, totalPrice);
    result = result.replace(/\{\{trip_deposit_amount\}\}/g, depositAmount);

    const depositCents = Math.round((totalCents * firstPercent) / 100);
    result = result.replace(
      /\{\{trip_price_breakdown\}\}/g,
      buildTripPriceBreakdownHtml({
        tripBaseCents: tripPrice * participantsCount,
        addonsCents: addon,
        totalCents,
        depositCents,
        firstPercent,
      }),
    );
  }

  // Terminy płatności: zaliczka = termin pierwszej raty, całość = termin ostatniej raty.
  // Uwaga: w głównym przepływie placeholdery są zwykle już podstawione w
  // replaceTripPlaceholders; tutaj obsługujemy przypadek wywołania standalone.
  if (tripStartDate || (options?.paymentSchedule?.length ?? 0) > 0) {
    const { depositDeadline, finalPaymentDeadline } = resolvePaymentDeadlines(
      options?.paymentSchedule,
      tripStartDate ?? null,
    );
    result = result.replace(/\{\{trip_deposit_deadline\}\}/g, depositDeadline);
    result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, finalPaymentDeadline);
  }

  return result;
}