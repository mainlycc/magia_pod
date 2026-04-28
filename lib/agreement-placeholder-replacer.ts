// Funkcja do zastępowania placeholderów danymi z wycieczki (bez danych klienta/rezerwacji)

import type { TripFullData, TripContentData } from "@/contexts/trip-context";
import { formatPostalAddressLine } from "./format-postal-address";

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

/**
 * Zastępuje placeholdery związane z wycieczką danymi z tripFullData i tripContentData
 * Placeholdery związane z klientem/rezerwacją pozostają bez zmian
 */
export function replaceTripPlaceholders(
  html: string,
  tripFullData: TripFullData | null,
  tripContentData: TripContentData | null
): string {
  if (!tripFullData) return html;

  let result = html;

  // Informacje o wycieczce
  result = result.replace(/\{\{trip_title\}\}/g, tripFullData.title || "-");
  result = result.replace(/\{\{trip_location\}\}/g, tripFullData.location || "-");
  result = result.replace(/\{\{trip_start_date\}\}/g, formatDate(tripFullData.start_date));
  result = result.replace(/\{\{trip_end_date\}\}/g, formatDate(tripFullData.end_date));
  result = result.replace(/\{\{trip_duration\}\}/g, calculateDuration(tripFullData.start_date, tripFullData.end_date));
  
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

  // Oblicz terminy płatności (14 dni przed wyjazdem)
  if (tripFullData.start_date) {
    try {
      const startDate = new Date(tripFullData.start_date);
      const depositDeadline = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const finalPaymentDeadline = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      result = result.replace(/\{\{trip_deposit_deadline\}\}/g, formatDate(depositDeadline.toISOString()));
      result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, formatDate(finalPaymentDeadline.toISOString()));
    } catch {
      result = result.replace(/\{\{trip_deposit_deadline\}\}/g, "-");
      result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, "-");
    }
  } else {
    result = result.replace(/\{\{trip_deposit_deadline\}\}/g, "-");
    result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, "-");
  }

  // Liczba noclegów
  const nights = calculateNights(tripFullData.start_date, tripFullData.end_date);
  result = result.replace(/\{\{nights_count\}\}/g, nights > 0 ? String(nights) : "-");

  // Dodatkowe świadczenia z tripContentData
  if (tripContentData?.dodatkowe_swiadczenia) {
    result = result.replace(/\{\{additional_services\}\}/g, tripContentData.dodatkowe_swiadczenia);
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

  // Kwota zaliczki (30% ceny)
  if (tripFullData.price_cents) {
    const depositAmount = ((tripFullData.price_cents * 0.3) / 100).toFixed(2);
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
    }>;
    participants_count?: number;
    participant_services?: Array<{
      service_type?: string;
      service_title?: string;
    }>;
  } | null,
  tripPrice?: number | null,
  tripStartDate?: string | null
): string {
  if (!formData) return html;

  let result = html;

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
    participantsCount = fromFormCount;
    participantsList = "-";
  }

  result = result.replace(/\{\{participants_count\}\}/g, String(participantsCount));
  result = result.replace(/\{\{participants_list\}\}/g, participantsList);

  // Usługi dodatkowe
  const selectedServices = formData.participant_services
    ?.map((s) => s.service_title || s.service_type || "")
    .filter(Boolean)
    .join(", ") || "";

  result = result.replace(/\{\{selected_services\}\}/g, selectedServices || "-");

  // Cena całkowita i zaliczka
  if (tripPrice && participantsCount > 0) {
    const totalPrice = ((tripPrice * participantsCount) / 100).toFixed(2);
    const depositAmount = ((tripPrice * participantsCount * 0.3) / 100).toFixed(2);
    result = result.replace(/\{\{trip_total_price\}\}/g, totalPrice);
    result = result.replace(/\{\{trip_deposit_amount\}\}/g, depositAmount);
  }

  // Terminy płatności (14 dni przed wyjazdem)
  if (tripStartDate) {
    try {
      const startDate = new Date(tripStartDate);
      const depositDeadline = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      const finalPaymentDeadline = new Date(startDate.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      result = result.replace(/\{\{trip_deposit_deadline\}\}/g, formatDate(depositDeadline.toISOString()));
      result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, formatDate(finalPaymentDeadline.toISOString()));
    } catch {
      // Ignore errors
    }
  }

  return result;
}