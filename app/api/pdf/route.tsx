import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { createAdminClient } from "@/lib/supabase/admin";

type PdfPayload = {
  booking_ref: string;
  trip: { title: string; start_date?: string | null; end_date?: string | null; price_cents?: number | null };
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

// Dane firmy organizującej (stałe)
const ORGANIZER_DATA = {
  name: "Magia Podróżowania GRUPA DE-PL",
  address: "Szczepankowo 37, 61-311 Poznań",
  nip: "6981710393",
};

// Stałe dla formatowania
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_TOP = 20;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

// Funkcja formatowania daty
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

// Funkcja rysująca linię poziomą
function drawHorizontalLine(doc: jsPDF, y: number, width: number = CONTENT_WIDTH): void {
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, MARGIN_LEFT + width, y);
}

// Funkcja rysująca linię poziomą grubą
function drawThickHorizontalLine(doc: jsPDF, y: number, width: number = CONTENT_WIDTH): void {
  doc.setLineWidth(1);
  doc.line(MARGIN_LEFT, y, MARGIN_LEFT + width, y);
}

// Funkcja dodająca tekst z automatycznym łamaniem
function addText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options: {
    fontSize?: number;
    fontStyle?: "normal" | "bold";
    maxWidth?: number;
    align?: "left" | "center" | "right" | "justify";
  } = {}
): number {
  const {
    fontSize = 11,
    fontStyle = "normal",
    maxWidth = CONTENT_WIDTH,
    align = "left",
  } = options;

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", fontStyle);

  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = fontSize * 1.2;
  let currentY = y;

  lines.forEach((line: string) => {
    doc.text(line, x, currentY, { align });
    currentY += lineHeight;
  });

  return currentY;
}

// Funkcja generująca PDF
function generatePdf(data: PdfPayload): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Przygotuj dane
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
  const hasCompany = !!(data.company_name || data.company_nip);

  let y = MARGIN_TOP;

  // ========== STRONA 1 ==========

  // Nagłówek
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const titleText = "UMOWA UCZESTNICTWA W WYCIECZCE";
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (PAGE_WIDTH - titleWidth) / 2, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const subtitleText = `Kod rezerwacji: ${data.booking_ref}`;
  const subtitleWidth = doc.getTextWidth(subtitleText);
  doc.text(subtitleText, (PAGE_WIDTH - subtitleWidth) / 2, y);
  y += 10;

  // Linia pod nagłówkiem
  drawThickHorizontalLine(doc, y);
  y += 15;

  // § 1. Strony umowy
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("§ 1. Strony umowy", MARGIN_LEFT, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("1. Organizator:", MARGIN_LEFT, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  y = addText(doc, `   ${ORGANIZER_DATA.name}`, MARGIN_LEFT, y, { fontSize: 11 });
  y = addText(doc, `   Adres: ${ORGANIZER_DATA.address}`, MARGIN_LEFT, y, { fontSize: 11 });
  y = addText(doc, `   NIP: ${ORGANIZER_DATA.nip}`, MARGIN_LEFT, y, { fontSize: 11 });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("2. Klient:", MARGIN_LEFT, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  y = addText(doc, `   ${clientName}`, MARGIN_LEFT, y, { fontSize: 11 });
  if (data.address) {
    y = addText(doc, `   Adres: ${clientAddress}`, MARGIN_LEFT, y, { fontSize: 11 });
  }
  y = addText(doc, `   E-mail: ${data.contact_email}`, MARGIN_LEFT, y, { fontSize: 11 });
  if (data.contact_phone) {
    y = addText(doc, `   Telefon: ${data.contact_phone}`, MARGIN_LEFT, y, { fontSize: 11 });
  }
  y += 8;

  if (hasCompany) {
    doc.setFont("helvetica", "bold");
    doc.text("3. Firma klienta:", MARGIN_LEFT, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    if (data.company_name) {
      y = addText(doc, `   Nazwa: ${data.company_name}`, MARGIN_LEFT, y, { fontSize: 11 });
    }
    if (data.company_nip) {
      y = addText(doc, `   NIP: ${data.company_nip}`, MARGIN_LEFT, y, { fontSize: 11 });
    }
    if (data.company_address) {
      const companyAddr = `${data.company_address.street}, ${data.company_address.zip} ${data.company_address.city}`;
      y = addText(doc, `   Adres: ${companyAddr}`, MARGIN_LEFT, y, { fontSize: 11 });
    }
    y += 8;
  }

  // § 2. Przedmiot umowy
  y += 5;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("§ 2. Przedmiot umowy", MARGIN_LEFT, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const subjectText =
    "Organizator zobowiązuje się do zorganizowania i przeprowadzenia wycieczki, a Klient zobowiązuje się do uiszczenia należnej opłaty za uczestnictwo w wycieczce.";
  y = addText(doc, subjectText, MARGIN_LEFT, y, { fontSize: 11, maxWidth: CONTENT_WIDTH });
  y += 8;

  // Szczegóły wycieczki
  const labelWidth = 50;
  const valueX = MARGIN_LEFT + labelWidth;

  doc.setFont("helvetica", "bold");
  doc.text("Nazwa wycieczki:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  y = addText(doc, data.trip.title, valueX, y, { fontSize: 11, maxWidth: CONTENT_WIDTH - labelWidth });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Termin wycieczki:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  const dateRange = `${formatDate(data.trip.start_date)} – ${formatDate(data.trip.end_date)}`;
  doc.text(dateRange, valueX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Cena za osobę:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${price} PLN`, valueX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Liczba uczestników:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(data.participants.length), valueX, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Cena całkowita:", MARGIN_LEFT, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${totalPrice} PLN`, valueX, y);
  y += 10;

  // § 3. Uczestnicy wycieczki
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("§ 3. Uczestnicy wycieczki", MARGIN_LEFT, y);
  y += 8;

  // Tabela uczestników
  const tableStartY = y;
  const tableWidth = CONTENT_WIDTH;
  const colWidths = [15, 70, 40, 65]; // Lp., Imię i nazwisko, PESEL, Dokument
  const rowHeight = 8;
  const headerHeight = 10;

  // Nagłówek tabeli
  let currentX = MARGIN_LEFT;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(232, 232, 232);
  doc.rect(currentX, y - headerHeight + 2, tableWidth, headerHeight, "F");
  doc.text("Lp.", currentX + colWidths[0] / 2, y, { align: "center" });
  currentX += colWidths[0];
  doc.text("Imię i nazwisko", currentX + colWidths[1] / 2, y, { align: "center" });
  currentX += colWidths[1];
  doc.text("PESEL", currentX + colWidths[2] / 2, y, { align: "center" });
  currentX += colWidths[2];
  doc.text("Dokument", currentX + colWidths[3] / 2, y, { align: "center" });
  y += headerHeight;

  // Ramka tabeli
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.rect(MARGIN_LEFT, tableStartY - headerHeight + 2, tableWidth, headerHeight, "S");

  // Wiersze z danymi
  doc.setFont("helvetica", "normal");
  data.participants.forEach((participant, index) => {
    if (y + rowHeight > PAGE_HEIGHT - MARGIN_BOTTOM - 30) {
      // Jeśli brakuje miejsca, przejdź do następnej strony
      doc.addPage();
      y = MARGIN_TOP;
    }

    currentX = MARGIN_LEFT;
    const rowY = y;

    // Lp.
    doc.text(String(index + 1), currentX + colWidths[0] / 2, rowY + 5, { align: "center" });
    currentX += colWidths[0];

    // Imię i nazwisko
    const fullName = `${participant.first_name} ${participant.last_name}`;
    const nameLines = doc.splitTextToSize(fullName, colWidths[1] - 4);
    doc.text(nameLines, currentX + 2, rowY + 5);
    currentX += colWidths[1];

    // PESEL
    doc.text(participant.pesel, currentX + colWidths[2] / 2, rowY + 5, { align: "center" });
    currentX += colWidths[2];

    // Dokument
    const documentText =
      participant.document_type && participant.document_number
        ? `${participant.document_type}: ${participant.document_number}`
        : "-";
    const docLines = doc.splitTextToSize(documentText, colWidths[3] - 4);
    doc.text(docLines, currentX + 2, rowY + 5);
    currentX += colWidths[3];

    // Linia oddzielająca wiersze
    drawHorizontalLine(doc, rowY + rowHeight, tableWidth);
    y += rowHeight;
  });

  // Zamknij ramkę tabeli
  const tableTotalHeight = y - tableStartY + headerHeight;
  doc.rect(MARGIN_LEFT, tableStartY - headerHeight + 2, tableWidth, tableTotalHeight, "S");

  // ========== STRONA 2 ==========
  doc.addPage();
  y = MARGIN_TOP;

  // § 4. Warunki uczestnictwa
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("§ 4. Warunki uczestnictwa", MARGIN_LEFT, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const conditions = [
    "1. Klient zobowiązuje się do uiszczenia pełnej opłaty za wycieczkę zgodnie z warunkami płatności określonymi przez Organizatora.",
    "2. Klient potwierdza, że zapoznał się z regulaminem wycieczki i warunkami uczestnictwa oraz akceptuje je w całości.",
    "3. Klient zobowiązuje się do przestrzegania przepisów bezpieczeństwa oraz regulaminu wycieczki podczas całego trwania imprezy.",
    "4. Organizator zobowiązuje się do zapewnienia uczestnikom wycieczki odpowiednich warunków zgodnie z programem wycieczki.",
    "5. Wszelkie zmiany w programie wycieczki mogą być wprowadzone wyłącznie za zgodą obu stron lub w przypadku wystąpienia siły wyższej.",
  ];

  conditions.forEach((condition) => {
    y = addText(doc, condition, MARGIN_LEFT, y, { fontSize: 11, maxWidth: CONTENT_WIDTH });
    y += 6;
  });

  y += 10;

  // § 5. Postanowienia końcowe
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("§ 5. Postanowienia końcowe", MARGIN_LEFT, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const finalProvisions = [
    "1. Umowa została zawarta na podstawie danych podanych przez Klienta podczas rezerwacji. Klient ponosi odpowiedzialność za prawdziwość i aktualność podanych danych.",
    "2. Klient potwierdza, że wyraził zgodę na przetwarzanie danych osobowych zgodnie z RODO oraz akceptuje regulamin i warunki uczestnictwa w wycieczce.",
    "3. W sprawach nieuregulowanych w niniejszej umowie zastosowanie mają przepisy Kodeksu Cywilnego oraz przepisy dotyczące imprez turystycznych.",
    "4. Umowa została sporządzona w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron.",
  ];

  finalProvisions.forEach((provision) => {
    y = addText(doc, provision, MARGIN_LEFT, y, { fontSize: 11, maxWidth: CONTENT_WIDTH });
    y += 6;
  });

  y += 20;

  // Linia oddzielająca
  drawThickHorizontalLine(doc, y);
  y += 10;

  // Data wygenerowania
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  const generationDate = new Date().toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  doc.text(`Data wygenerowania umowy: ${generationDate}`, MARGIN_LEFT, y);
  y += 20;

  // Podpisy
  const signatureBoxWidth = (CONTENT_WIDTH - 30) / 2;
  const leftSignatureX = MARGIN_LEFT;
  const rightSignatureX = MARGIN_LEFT + signatureBoxWidth + 30;

  // Podpis Organizatora
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Podpis Organizatora", leftSignatureX, y);
  y += 50;

  drawHorizontalLine(doc, y, signatureBoxWidth);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const organizerLines = doc.splitTextToSize(ORGANIZER_DATA.name, signatureBoxWidth);
  doc.text(organizerLines, leftSignatureX, y);

  // Podpis Klienta
  y = MARGIN_TOP + 200;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Podpis Klienta", rightSignatureX, y);
  y += 50;

  drawHorizontalLine(doc, y, signatureBoxWidth);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 51, 51);
  const clientLines = doc.splitTextToSize(clientName, signatureBoxWidth);
  doc.text(clientLines, rightSignatureX, y);

  // Konwertuj do Buffer
  const arrayBuffer = doc.output("arraybuffer");
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

    const buf = generatePdf(body);

    // Upload do Supabase Storage (agreements/<booking_ref>.pdf)
    const supabaseAdmin = createAdminClient();
    const { error: upErr } = await supabaseAdmin.storage
      .from("agreements")
      .upload(`${body.booking_ref}.pdf`, buf, { contentType: "application/pdf", upsert: true });

    if (upErr) {
      // jeśli nie uda się upload, i tak zwróć PDF base64, żeby e-mail mógł pójść
      const base64 = buf.toString("base64");
      return NextResponse.json({ base64, filename: `${body.booking_ref}.pdf` });
    }

    // Zapisz URL w bookings (przechowuj ścieżkę, generuj signed URL na żądanie)
    await supabaseAdmin
      .from("bookings")
      .update({ agreement_pdf_url: `${body.booking_ref}.pdf` })
      .eq("booking_ref", body.booking_ref);

    const base64 = buf.toString("base64");
    return NextResponse.json({ base64, filename: `${body.booking_ref}.pdf` });
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
