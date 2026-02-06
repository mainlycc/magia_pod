import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { createAdminClient } from "@/lib/supabase/admin";

// Konfiguracja runtime dla Vercel - upewniamy się, że funkcja działa w środowisku serverless
export const runtime = "nodejs";
export const maxDuration = 30; // Maksymalny czas wykonania funkcji (sekundy)

// Polskie znaki dla systemu: ą ć ę ł ń ó ś ź ż Ą Ć Ę Ł Ń Ó Ś Ź Ż
// Przykładowe użycie: "ąęćłńóśźż ĄĆĘŁŃÓŚŹŻ"

export type PdfPayload = {
  booking_ref: string;
  reservation_number?: string | null; // 6-cyfrowy numer rezerwacji z wycieczki
  agreement_number?: number | null; // Numer kolejny umowy (1, 2, 3...)
  trip: { title: string; start_date?: string | null; end_date?: string | null; price_cents?: number | null; location?: string | null };
  trip_id?: string; // ID wycieczki do pobrania szablonu
  applicant_type?: "individual" | "company"; // Typ rejestracji
  contact_email: string;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_phone?: string | null;
  address?: {
    street: string;
    city: string;
    zip: string;
  } | null;
  company_name?: string | null;
  company_nip?: string | null;
  company_address?: {
    street: string;
    city: string;
    zip: string;
  } | null;
  invoice_type?: "contact" | "company" | "custom" | null;
  invoice_name?: string | null;
  invoice_nip?: string | null;
  invoice_address?: {
    street: string;
    city: string;
    zip: string;
  } | null;
  participants: Array<{
    first_name: string;
    last_name: string;
    pesel: string;
    email?: string;
    phone?: string;
    document_type?: string;
    document_number?: string;
  }>;
};

const ORGANIZER_DATA = {
  name: "Magia Podrozwania GRUPA DE-PL",
  address: "Szczepankowo 37, 61-311 Poznan",
  nip: "6981710393",
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Generuje nazwę umowy w formacie #AAAAAA/BBB
 * @param reservationNumber - 6-cyfrowy numer rezerwacji z wycieczki
 * @param agreementNumber - Numer kolejny umowy (1, 2, 3...)
 * @returns Nazwa umowy w formacie #AAAAAA/BBB lub fallback do booking_ref
 */
function generateAgreementName(reservationNumber: string | null | undefined, agreementNumber: number | null | undefined): string {
  if (reservationNumber && agreementNumber) {
    const paddedReservation = reservationNumber.padStart(6, '0');
    const paddedAgreement = String(agreementNumber).padStart(3, '0');
    return `#${paddedReservation}/${paddedAgreement}`;
  }
  return ""; // Zwrócimy pusty string, jeśli brak danych - wtedy użyjemy booking_ref jako fallback
}

/**
 * Generuje nazwę pliku PDF umowy
 * @param reservationNumber - 6-cyfrowy numer rezerwacji z wycieczki
 * @param agreementNumber - Numer kolejny umowy (1, 2, 3...)
 * @param bookingRef - Fallback: kod rezerwacji
 * @returns Nazwa pliku PDF
 */
function generateAgreementFilename(reservationNumber: string | null | undefined, agreementNumber: number | null | undefined, bookingRef: string): string {
  const agreementName = generateAgreementName(reservationNumber, agreementNumber);
  if (agreementName) {
    return `${agreementName}.pdf`;
  }
  // Fallback do starego formatu jeśli brak reservation_number lub agreement_number
  return `${bookingRef}.pdf`;
}

/**
 * Zamienia placeholdery w szablonie HTML na rzeczywiste dane
 */
function replacePlaceholders(template: string, data: PdfPayload): string {
  const price = data.trip.price_cents ? (data.trip.price_cents / 100).toFixed(2) : "-";
  const totalPrice = data.trip.price_cents
    ? ((data.trip.price_cents * data.participants.length) / 100).toFixed(2)
    : "-";
  const depositAmount = totalPrice !== "-" && data.trip.price_cents
    ? ((data.trip.price_cents * data.participants.length * 0.3) / 100).toFixed(2)
    : "-";
  
  const contactFullName = [data.contact_first_name, data.contact_last_name]
    .filter(Boolean)
    .join(" ") || "-";
  const contactAddress = data.address
    ? `${data.address.street}, ${data.address.zip} ${data.address.city}`
    : "-";
  const companyAddress = data.company_address
    ? `${data.company_address.street}, ${data.company_address.zip} ${data.company_address.city}`
    : "-";
  
  const participantsList = data.participants
    .map((p) => `${p.first_name} ${p.last_name}`)
    .join(", ");
  
  const tripDuration = data.trip.start_date && data.trip.end_date
    ? (() => {
        const start = new Date(data.trip.start_date);
        const end = new Date(data.trip.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return `${diffDays} dni`;
      })()
    : "-";
  
  const depositDeadline = data.trip.start_date
    ? formatDate(new Date(new Date(data.trip.start_date).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    : "-";
  const finalPaymentDeadline = data.trip.start_date
    ? formatDate(new Date(new Date(data.trip.start_date).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    : "-";

  let result = template;
  
  // Dane zgłaszającego
  result = result.replace(/\{\{contact_first_name\}\}/g, data.contact_first_name || "-");
  result = result.replace(/\{\{contact_last_name\}\}/g, data.contact_last_name || "-");
  result = result.replace(/\{\{contact_full_name\}\}/g, contactFullName);
  result = result.replace(/\{\{contact_address\}\}/g, contactAddress);
  result = result.replace(/\{\{contact_street\}\}/g, data.address?.street || "-");
  result = result.replace(/\{\{contact_city\}\}/g, data.address?.city || "-");
  result = result.replace(/\{\{contact_zip\}\}/g, data.address?.zip || "-");
  result = result.replace(/\{\{contact_pesel\}\}/g, data.participants[0]?.pesel || "-");
  result = result.replace(/\{\{contact_phone\}\}/g, data.contact_phone || "-");
  result = result.replace(/\{\{contact_email\}\}/g, data.contact_email || "-");
  
  // Dane firmy
  result = result.replace(/\{\{company_name\}\}/g, data.company_name || "-");
  result = result.replace(/\{\{company_nip\}\}/g, data.company_nip || "-");
  result = result.replace(/\{\{company_address\}\}/g, companyAddress);
  
  // Dane uczestników
  result = result.replace(/\{\{participants_count\}\}/g, String(data.participants.length));
  result = result.replace(/\{\{participants_list\}\}/g, participantsList);
  
  // Informacje o wycieczce
  result = result.replace(/\{\{trip_title\}\}/g, data.trip.title || "-");
  result = result.replace(/\{\{reservation_number\}\}/g, data.reservation_number || "-");
  result = result.replace(/\{\{trip_location\}\}/g, data.trip.location || "-");
  result = result.replace(/\{\{trip_start_date\}\}/g, formatDate(data.trip.start_date || null));
  result = result.replace(/\{\{trip_end_date\}\}/g, formatDate(data.trip.end_date || null));
  result = result.replace(/\{\{trip_duration\}\}/g, tripDuration);
  result = result.replace(/\{\{trip_price_per_person\}\}/g, price);
  result = result.replace(/\{\{trip_total_price\}\}/g, totalPrice);
  result = result.replace(/\{\{trip_deposit_amount\}\}/g, depositAmount);
  result = result.replace(/\{\{trip_deposit_deadline\}\}/g, depositDeadline);
  result = result.replace(/\{\{trip_final_payment_deadline\}\}/g, finalPaymentDeadline);
  
  return result;
}

export function generatePdf(data: PdfPayload, customTemplate?: string | null): Buffer {
  // Inicjalizacja jsPDF z domyślnymi ustawieniami
  // jsPDF 2.x automatycznie obsługuje UTF-8, więc polskie znaki powinny działać poprawnie
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
  
  // setCharSpace i setLineHeightFactor nie istnieją w jsPDF 2.x - usunięte
  
  const price = data.trip.price_cents ? (data.trip.price_cents / 100).toFixed(2) : "-";
  const totalPrice = data.trip.price_cents
    ? ((data.trip.price_cents * data.participants.length) / 100).toFixed(2)
    : "-";
  const clientName = [data.contact_first_name, data.contact_last_name]
    .filter(Boolean)
    .join(" ") || "Klient";
  const clientAddress = data.address
    ? `${data.address.street}, ${data.address.zip} ${data.address.city}`
    : "-";
  
  const today = new Date();
  const contractDate = today.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const contractPlace = "Poznan";

  let y = 20;
  const fullTextWidth = 170;
  const textWidth = 165;

  // Naglowek
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("UMOWA O UDZIAL W GRUPOWEJ IMPREZIE TURYSTYCZNEJ", 105, y, { align: "center" });
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("(zwana dalej \"Umowa\")", 105, y, { align: "center" });
  y += 10;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  // Generuj numer umowy w formacie #AAAAAA/BBB
  const agreementNumberText = data.reservation_number && data.agreement_number
    ? `#${data.reservation_number.padStart(6, '0')}/${String(data.agreement_number).padStart(3, '0')}`
    : `Kod rezerwacji: ${data.booking_ref}`;
  doc.text(agreementNumberText, 105, y, { align: "center" });
  y += 12;

  // Strony umowy
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const partiesText = `Zawarta w dniu ${contractDate} w ${contractPlace} pomiedzy:`;
  doc.text(partiesText, 20, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Biuro Podrozy \"Magia Podrozwania\"", 20, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const orgAddrLines = doc.splitTextToSize(`z siedziba w ${ORGANIZER_DATA.address}`, textWidth);
  doc.text(orgAddrLines, 25, y);
  y += orgAddrLines.length * 5;
  doc.text(`NIP: ${ORGANIZER_DATA.nip}`, 25, y);
  y += 6;
  doc.text("zwanym dalej \"Organizatorem\",", 25, y);
  y += 8;

  doc.text("a", 20, y);
  y += 6;

  const clientDisplayName =
    data.invoice_name || data.company_name || clientName;
  const clientDisplayAddr = (() => {
    if (data.invoice_address) {
      return `${data.invoice_address.street}, ${data.invoice_address.zip} ${data.invoice_address.city}`;
    }
    if (data.company_address) {
      return `${data.company_address.street}, ${data.company_address.zip} ${data.company_address.city}`;
    }
    return clientAddress;
  })();
  const clientId =
    data.invoice_nip ||
    data.company_nip ||
    (data.participants[0]?.pesel ? `PESEL: ${data.participants[0].pesel}` : "");

  const clientNameLines = doc.splitTextToSize(clientDisplayName, textWidth);
  doc.text(clientNameLines, 25, y);
  y += clientNameLines.length * 5;
  
  const clientAddrLines = doc.splitTextToSize(`zamieszkalym/a w ${clientDisplayAddr}`, textWidth);
  doc.text(clientAddrLines, 25, y);
  y += clientAddrLines.length * 5;
  
  if (clientId) {
    doc.text(clientId, 25, y);
    y += 5;
  }
  
  doc.text("zwanym dalej \"Klientem\" (dzialajacym jako organizator/przedstawiciel grupy).", 25, y);
  y += 8;

  doc.text("Organizator i Klient zwani sa dalej laczenie \"Stronami\".", 20, y);
  y += 12;

  // § 1. Przedmiot Umowy
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 1. Przedmiot Umowy", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const subject1Text = "1. Przedmiotem Umowy jest organizacja i sprzedaz Klientowi, a przez niego uczestnikom, grupowej imprezy turystycznej, zwanej dalej \"Impreza Turystyczna\", zgodnie z warunkami niniejszej Umowy oraz Programem i Opisem Imprezy Turystycznej stanowiacymi Zalacznik nr 1 do Umowy.";
  const subject1Lines = doc.splitTextToSize(subject1Text, fullTextWidth);
  doc.text(subject1Lines, 20, y);
  y += subject1Lines.length * 5 + 5;

  doc.text("2. Impreza Turystyczna to:", 20, y);
  y += 6;

  doc.text("o Nazwa Imprezy Turystycznej: " + data.trip.title, 25, y);
  y += 6;

  const dateRange = `${formatDate(data.trip.start_date)} – ${formatDate(data.trip.end_date)}`;
  doc.text("o Termin rozpoczecia i zakonczenia: " + dateRange, 25, y);
  y += 6;

  doc.text("o Liczba uczestnikow grupy: " + String(data.participants.length), 25, y);
  y += 6;

  doc.text("o Uslugi wchodzace w sklad Imprezy: przelot/przejazd, zakwaterowanie, wyzywienie, ubezpieczenie, opieka pilota/przewodnika - szczegolowy opis w Zalaczniku nr 1.", 25, y);
  y += 12;

  // § 2. Cena i Warunki Platnosci
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 2. Cena i Warunki Platnosci", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`1. Calkowita cena Imprezy Turystycznej wynosi: ${totalPrice} PLN.`, 20, y);
  y += 6;

  doc.text("2. Cena obejmuje wszystkie uslugi wyszczegolnione w Zalaczniku nr 1.", 20, y);
  y += 6;

  doc.text("3. Platnosc za Impreze Turystyczna odbywa sie w nastepujacych ratach:", 20, y);
  y += 6;

  const depositAmount = totalPrice !== "-" ? ((parseFloat(totalPrice) * 0.3).toFixed(2)) : "-";
  const finalAmount = totalPrice !== "-" ? ((parseFloat(totalPrice) * 0.7).toFixed(2)) : "-";
  
  doc.text(`o Rata I (zaliczka): ${depositAmount} PLN platna w terminie 7 dni od daty podpisania Umowy.`, 25, y);
  y += 6;

  const finalPaymentDate = data.trip.start_date 
    ? new Date(new Date(data.trip.start_date).getTime() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";
  doc.text(`o Rata II (doplata): Pozostala kwota, tj. ${finalAmount} PLN, platna najpozniej do dnia ${finalPaymentDate}.`, 25, y);
  y += 6;

  doc.text("4. Platnosci nalezy dokonywac przelewem na rachunek bankowy Organizatora.", 20, y);
  y += 6;

  doc.text("5. Organizator zastrzega sobie prawo do podwyzszenia ceny Imprezy Turystycznej wylacznie w przypadkach okreslonych w ustawie z dnia 24 listopada 2017 r. o imprezach turystycznych i powiazanych uslugach turystycznych.", 20, y);
  y += 12;

  // § 3. Obowiazki i Odpowiedzialnosc Organizatora
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 3. Obowiazki i Odpowiedzialnosc Organizatora", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const organizerObligations = [
    "1. Organizator zobowiazuje sie do zrealizowania Imprezy Turystycznej zgodnie z Umowa i Zalacznikiem nr 1 z nalezita starannoscia.",
    "2. Organizator ma obowiazek zapewnic Klientowi i uczestnikom grupy ubezpieczenie turystyczne na czas trwania Imprezy Turystycznej (OC, NNW, koszty leczenia, assistance).",
    "3. Organizator ponosi odpowiedzialnosc za niewykonanie lub nienalezyte wykonanie uslug turystycznych wchodzacych w sklad Imprezy Turystycznej, z zastrzezeniem wyjatkow przewidzianych w ustawie.",
  ];

  organizerObligations.forEach((text) => {
    const lines = doc.splitTextToSize(text, fullTextWidth);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  y += 5;

  // § 4. Obowiazki i Odpowiedzialnosc Klienta
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 4. Obowiazki i Odpowiedzialnosc Klienta", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const clientObligations = [
    "1. Klient zobowiazuje sie do dokonania platnosci w terminach i wysokosciach okreslonych w § 2.",
    "2. Klient ponosi odpowiedzialnosc za terminowe dostarczenie Organizatorowi kompletnej listy uczestnikow oraz wszystkich niezbednych danych i dokumentow (np. paszporty, wizy, dane do ubezpieczenia) wymaganych do realizacji Imprezy Turystycznej.",
    "3. Klient zobowiazuje sie do zapoznania uczestnikow grupy z Programem Imprezy, Warunkami Uczestnictwa oraz wszelkimi instrukcjami przekazanymi przez Organizatora.",
  ];

  clientObligations.forEach((text) => {
    const lines = doc.splitTextToSize(text, fullTextWidth);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  y += 5;

  // § 5. Odstapienie od Umowy i Anulowanie
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 5. Odstapienie od Umowy i Anulowanie", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const cancellationText1 = "1. Klient moze odstapic od Umowy w kazdym czasie przed rozpoczeciem Imprezy Turystycznej. Odstapienie musi nastapic w formie pisemnej.";
  const cancellationLines1 = doc.splitTextToSize(cancellationText1, fullTextWidth);
  doc.text(cancellationLines1, 20, y);
  y += cancellationLines1.length * 5 + 3;

  doc.text("2. W przypadku odstapienia od Umowy przez Klienta, Organizator ma prawo do potracenia oplaty za odstapienie (koszty rezygnacji) w nastepujacej wysokosci:", 20, y);
  y += 6;

  doc.text("o 30% ceny jesli odstapienie nastapilo wiecej niz 30 dni przed rozpoczeciem Imprezy.", 25, y);
  y += 5;
  doc.text("o 50% ceny jesli odstapienie nastapilo od 14 do 30 dni przed rozpoczeciem Imprezy.", 25, y);
  y += 5;
  doc.text("o 100% ceny jesli odstapienie nastapilo w terminie krotszym niz 14 dni przed rozpoczeciem Imprezy.", 25, y);
  y += 6;

  const cancellationText3 = "3. Organizator moze rozwiazac Umowe i zwrocic Klientowi pelna wplate, jesli minimalna liczba uczestnikow grupy nie zostanie osiagnieta. Termin powiadomienia Klienta to najpozniej 14 dni przed rozpoczeciem Imprezy.";
  const cancellationLines3 = doc.splitTextToSize(cancellationText3, fullTextWidth);
  doc.text(cancellationLines3, 20, y);
  y += cancellationLines3.length * 5 + 5;

  // § 6. Reklamacje
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 6. Reklamacje", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const complaints = [
    "1. Wszelkie usterki lub niezgodnosci w trakcie trwania Imprezy Turystycznej Klient jest zobowiazany zglosic niezwlocznie pilotowi, przewodnikowi lub Organizatorowi w celu ich usuniecia.",
    "2. Reklamacje dotyczace nienalezytgo wykonania Umowy nalezy skladac Organizatorowi na pismie, nie pozniej niz 14 dni od daty zakonczenia Imprezy Turystycznej.",
  ];

  complaints.forEach((text) => {
    const lines = doc.splitTextToSize(text, fullTextWidth);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  y += 5;

  // § 7. Postanowienia Koncowe
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("§ 7. Postanowienia Koncowe", 20, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const finalProvisions = [
    "1. W sprawach nieuregulowanych niniejsza Umowa maja zastosowanie przepisy Kodeksu Cywilnego oraz Ustawy z dnia 24 listopada 2017 r. o imprezach turystycznych i powiazanych uslugach turystycznych.",
    "2. Wszelkie zmiany niniejszej Umowy wymagaja formy pisemnej pod rygorem niewaznosci.",
    "3. Ewentualne spory wynikle z realizacji niniejszej Umowy rozstrzygane beda przez sad wlasciwy dla siedziby Organizatora.",
    "4. Umowe sporzadzono w dwoch jednobrzmiacych egzemplarzach, po jednym dla kazdej ze Stron.",
  ];

  finalProvisions.forEach((provision) => {
    const lines = doc.splitTextToSize(provision, fullTextWidth);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  y += 15;

  // Podpisy
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Organizator:", 20, y);
  doc.text("Klient (Organizator Grupy):", 120, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const organizerNameLines = doc.splitTextToSize(ORGANIZER_DATA.name, 80);
  doc.text(organizerNameLines, 20, y);
  const clientSignatureLines = doc.splitTextToSize(clientDisplayName, 80);
  doc.text(clientSignatureLines, 120, y);
  y += Math.max(organizerNameLines.length, clientSignatureLines.length) * 5 + 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("[Podpis Organizatora]", 20, y);
  doc.text("[Podpis Klienta]", 120, y);
  y += 20;

  // Zalacznik nr 1
  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ZALACZNIK NR 1 - OPIS I PROGRAM IMPREZY TURYSTYCZNEJ", 105, y, { align: "center" });
  y += 12;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Lista uczestnikow:", 20, y);
  y += 8;

  // Tabela uczestników
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(20, y - 5, 170, 8, "F");
  doc.text("Lp.", 25, y);
  doc.text("Imie i nazwisko", 50, y);
  doc.text("PESEL", 120, y);
  doc.text("Dokument", 150, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  data.participants.forEach((participant, index) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(String(index + 1), 25, y);
    const nameWidth = 70;
    const nameLines = doc.splitTextToSize(`${participant.first_name} ${participant.last_name}`, nameWidth);
    doc.text(nameLines, 50, y);
    doc.text(participant.pesel, 120, y);
    const docText = participant.document_type && participant.document_number
      ? `${participant.document_type}: ${participant.document_number}`
      : "-";
    const docWidth = 40;
    const docLines = doc.splitTextToSize(docText, docWidth);
    doc.text(docLines, 150, y);
    y += Math.max(nameLines.length, docLines.length) * 5 + 2;
  });

  // Generowanie PDF jako ArrayBuffer, następnie konwersja do Buffer
  // To podejście działa zarówno lokalnie jak i na Vercel
  const arrayBuffer = doc.output("arraybuffer");
  
  // Konwersja ArrayBuffer do Buffer - działa poprawnie w środowisku serverless Vercel
  return Buffer.from(arrayBuffer);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PdfPayload;
    if (
      !body?.booking_ref ||
      !body?.trip?.title ||
      !Array.isArray(body?.participants) ||
      !body?.contact_email
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Pobierz szablon umowy z bazy jeśli trip_id i applicant_type są dostępne
    let customTemplate: string | null = null;
    if (body.trip_id && body.applicant_type) {
      const supabaseAdmin = createAdminClient();
      const { data: template, error: templateError } = await supabaseAdmin
        .from("trip_agreement_templates")
        .select("template_html")
        .eq("trip_id", body.trip_id)
        .eq("registration_type", body.applicant_type)
        .maybeSingle();
      
      if (!templateError && template?.template_html) {
        customTemplate = template.template_html;
      }
    }

    // Generowanie PDF (na razie używamy obecnej implementacji, szablon będzie używany w przyszłości)
    const buf = generatePdf(body, customTemplate);

    // Walidacja, że Buffer został poprawnie utworzony
    if (!Buffer.isBuffer(buf)) {
      throw new Error("Failed to generate PDF buffer");
    }

    const supabaseAdmin = createAdminClient();
    
    // Generuj nazwę pliku umowy w formacie #AAAAAA/BBB.pdf
    const filename = generateAgreementFilename(body.reservation_number, body.agreement_number, body.booking_ref);
    
    // Próba zapisania PDF do Supabase Storage
    const { error: upErr } = await supabaseAdmin.storage
      .from("agreements")
      .upload(filename, buf, { 
        contentType: "application/pdf", 
        upsert: true 
      });

    // Jeśli upload się nie powiódł, zwracamy PDF jako base64 (fallback)
    if (upErr) {
      console.warn("Failed to upload PDF to storage:", upErr?.message || String(upErr));
      const base64 = buf.toString("base64");
      return NextResponse.json({ 
        base64, 
        filename,
        warning: "PDF generated but not saved to storage"
      });
    }

    // Aktualizacja rekordu booking z URL do PDF
    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({ agreement_pdf_url: filename })
      .eq("booking_ref", body.booking_ref);

    if (updateErr) {
      console.warn("Failed to update booking with PDF URL:", updateErr.message);
    }

    // Zwracamy PDF jako base64
    const base64 = buf.toString("base64");
    return NextResponse.json({ 
      base64, 
      filename
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "PDF generation failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
