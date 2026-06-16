import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NOTO_SANS_FAMILY, registerNotoFonts } from "@/lib/pdf/register-noto-fonts";
import { format } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";
import { pl } from "date-fns/locale";
import {
  getAgreementConclusionDate,
  isConcludedAgreement,
  isEffectiveDateInRange,
  resolvePeriodBounds,
} from "@/lib/reports/tfg-agreement-report-dates";

export {
  getAgreementConclusionDate,
  isConcludedAgreement,
  isEffectiveDateInRange,
  REPORT_TIMEZONE,
  resolvePeriodBounds,
} from "@/lib/reports/tfg-agreement-report-dates";

export const TFG_REPORT_TYPES = [
  "tfg_signed_detail",
  "tfg_signed_summary",
  "tfg_cancellations_detail",
  "tfg_cancellations_summary",
] as const;

export type TfgReportType = (typeof TFG_REPORT_TYPES)[number];

export type TfgReportFormat = "xlsx" | "pdf";

export const DETAIL_HEADERS = [
  "Numer umowy",
  "Przedmiot umowy",
  "Data zawarcia umowy",
  "Termin rozpoczęcia imprezy",
  "Termin zakończenia imprezy",
  "Liczba podróżnych",
  "Cena (PLN)",
  "Miejsce / trasa",
  "Środek transportu",
  "Kody lotnisk",
  "—",
  "—",
  "Kategoria TFG/TFP",
  "Data anulacji",
] as const;

type TripLite = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  category: string | null;
  price_cents: number | null;
  reservation_number: string | null;
  transport_mode: string | null;
  airport_codes: string | null;
};

type BookingLite = {
  id: string;
  status: string;
  payment_status: string | null;
  booking_ref: string;
  cancelled_at: string | null;
  trips: TripLite | TripLite[] | null;
  participants: { id: string }[] | null;
};

type AgreementLite = {
  id: string;
  agreement_seq: number | null;
  generated_at: string;
  signed_at: string | null;
  status: string;
  booking_id: string;
};

function unwrapTrip(t: BookingLite["trips"]): TripLite | null {
  if (!t) return null;
  return Array.isArray(t) ? t[0] ?? null : t;
}

function formatPlDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: pl });
  } catch {
    return iso;
  }
}

export function formatAgreementNumber(
  reservationNumber: string | null | undefined,
  seq: number | null | undefined,
): string {
  if (seq != null && seq > 0) {
    const resRaw = reservationNumber ? String(reservationNumber).trim().replace(/^#+/, "") : "";
    const res = resRaw ? resRaw.padStart(6, "0") : "—";
    return `#${res}/${String(seq).padStart(3, "0")}`;
  }
  return "";
}

function participantCount(b: BookingLite): number {
  const p = b.participants;
  if (!Array.isArray(p)) return 0;
  return p.length;
}

function contractPricePln(trip: TripLite | null, participants: number): number {
  const cents = trip?.price_cents ?? 0;
  const n = Math.max(0, participants);
  return (cents * n) / 100;
}

function formatMoneyPln(value: number): string {
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function buildDetailRowFromBooking(
  booking: BookingLite,
  agreement: { agreement_seq: number | null; conclusion_date: string } | null,
  options: { cancellationDate?: string | null },
): string[] {
  const trip = unwrapTrip(booking.trips);
  const n = participantCount(booking);
  const price = contractPricePln(trip, n);
  const seq = agreement?.agreement_seq ?? null;
  const resNum = trip?.reservation_number ?? null;

  return [
    formatAgreementNumber(resNum, seq),
    trip?.title ?? "",
    agreement ? formatPlDate(agreement.conclusion_date) : "",
    formatPlDate(trip?.start_date ?? null),
    formatPlDate(trip?.end_date ?? null),
    String(n),
    formatMoneyPln(price),
    trip?.location ?? "",
    trip?.transport_mode ?? "",
    trip?.airport_codes ?? "",
    "",
    "",
    trip?.category ?? "",
    options.cancellationDate ? formatPlDate(options.cancellationDate) : "",
  ];
}

export type SummaryRow = {
  category: string;
  agreementCount: number;
  participantSum: number;
  valueSumPln: number;
};

export function aggregateSummary(rows: { category: string; participants: number; valuePln: number }[]): SummaryRow[] {
  const map = new Map<string, { agreementCount: number; participantSum: number; valueSumPln: number }>();
  for (const r of rows) {
    const key = r.category.trim() || "(brak kategorii)";
    const cur = map.get(key) ?? { agreementCount: 0, participantSum: 0, valueSumPln: 0 };
    cur.agreementCount += 1;
    cur.participantSum += r.participants;
    cur.valueSumPln += r.valuePln;
    map.set(key, cur);
  }
  const sorted = [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => a.category.localeCompare(b.category, "pl"));
  if (sorted.length > 1) {
    const agreementCount = sorted.reduce((s, r) => s + r.agreementCount, 0);
    const participantSum = sorted.reduce((s, r) => s + r.participantSum, 0);
    const valueSumPln = sorted.reduce((s, r) => s + r.valueSumPln, 0);
    sorted.push({ category: "RAZEM", agreementCount, participantSum, valueSumPln });
  }
  return sorted;
}

const SUMMARY_HEADERS = [
  "Kategoria wycieczki",
  "Liczba umów / rezerwacji",
  "Suma uczestników",
  "Suma wartości (PLN)",
] as const;

async function fetchAgreementsInConclusionPeriod(
  admin: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<AgreementLite[]> {
  const orFilter = [
    `and(signed_at.gte.${startIso},signed_at.lte.${endIso})`,
    `and(signed_at.is.null,generated_at.gte.${startIso},generated_at.lte.${endIso})`,
  ].join(",");

  const { data, error } = await admin
    .from("agreements")
    .select("id, agreement_seq, generated_at, signed_at, status, booking_id")
    .or(orFilter);

  if (error) throw new Error(error.message);

  const byId = new Map<string, AgreementLite>();
  for (const row of data ?? []) {
    const ag = row as AgreementLite;
    const conclusionDate = getAgreementConclusionDate(ag);
    if (!isEffectiveDateInRange(conclusionDate, startIso, endIso)) continue;
    byId.set(ag.id, ag);
  }

  return [...byId.values()];
}

export async function fetchSignedAgreementRows(
  admin: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<{ detail: string[][]; summaryInputs: { category: string; participants: number; valuePln: number }[] }> {
  const list = await fetchAgreementsInConclusionPeriod(admin, startIso, endIso);
  if (list.length === 0) {
    return { detail: [], summaryInputs: [] };
  }

  const bookingIds = [...new Set(list.map((a) => a.booking_id))];
  const { data: bookings, error: bErr } = await admin
    .from("bookings")
    .select(
      `
      id,
      status,
      payment_status,
      booking_ref,
      cancelled_at,
      trips (
        title,
        start_date,
        end_date,
        location,
        category,
        price_cents,
        reservation_number,
        transport_mode,
        airport_codes
      ),
      participants (id)
    `,
    )
    .in("id", bookingIds);

  if (bErr) throw new Error(bErr.message);

  const byId = new Map((bookings as BookingLite[] | null)?.map((b) => [b.id, b]) ?? []);

  const detail: string[][] = [];
  const summaryInputs: { category: string; participants: number; valuePln: number }[] = [];

  for (const ag of list) {
    const b = byId.get(ag.booking_id);
    if (!b || !isConcludedAgreement(ag, b)) continue;

    const trip = unwrapTrip(b.trips);
    const n = participantCount(b);
    const valuePln = contractPricePln(trip, n);
    const conclusionDate = getAgreementConclusionDate(ag);

    detail.push(
      buildDetailRowFromBooking(
        b,
        { agreement_seq: ag.agreement_seq, conclusion_date: conclusionDate },
        {},
      ),
    );
    summaryInputs.push({
      category: trip?.category ?? "",
      participants: n,
      valuePln,
    });
  }

  return { detail, summaryInputs };
}

export async function fetchCancellationRows(
  admin: SupabaseClient,
  startIso: string,
  endIso: string,
): Promise<{ detail: string[][]; summaryInputs: { category: string; participants: number; valuePln: number }[] }> {
  const { data: bookings, error: bErr } = await admin
    .from("bookings")
    .select(
      `
      id,
      status,
      payment_status,
      booking_ref,
      cancelled_at,
      trips (
        title,
        start_date,
        end_date,
        location,
        category,
        price_cents,
        reservation_number,
        transport_mode,
        airport_codes
      ),
      participants (id)
    `,
    )
    .eq("status", "cancelled")
    .gte("cancelled_at", startIso)
    .lte("cancelled_at", endIso);

  if (bErr) throw new Error(bErr.message);

  const blist = (bookings as BookingLite[] | null) ?? [];
  if (blist.length === 0) {
    return { detail: [], summaryInputs: [] };
  }

  const bookingIds = blist.map((b) => b.id);
  const { data: agreements, error: agErr } = await admin
    .from("agreements")
    .select("booking_id, agreement_seq, generated_at, signed_at")
    .in("booking_id", bookingIds);

  if (agErr) throw new Error(agErr.message);

  const bestAg = new Map<string, { agreement_seq: number | null; conclusion_date: string }>();
  for (const a of agreements ?? []) {
    const conclusionDate = getAgreementConclusionDate(
      a as { signed_at: string | null; generated_at: string },
    );
    const prev = bestAg.get(a.booking_id);
    if (!prev || Date.parse(conclusionDate) >= Date.parse(prev.conclusion_date)) {
      bestAg.set(a.booking_id, {
        agreement_seq: a.agreement_seq,
        conclusion_date: conclusionDate,
      });
    }
  }

  const detail: string[][] = [];
  const summaryInputs: { category: string; participants: number; valuePln: number }[] = [];

  for (const b of blist) {
    const trip = unwrapTrip(b.trips);
    const n = participantCount(b);
    const valuePln = contractPricePln(trip, n);
    const ag = bestAg.get(b.id) ?? null;
    detail.push(
      buildDetailRowFromBooking(b, ag, { cancellationDate: b.cancelled_at }),
    );
    summaryInputs.push({
      category: trip?.category ?? "",
      participants: n,
      valuePln,
    });
  }

  return { detail, summaryInputs };
}

export async function buildXlsxBuffer(opts: {
  reportType: TfgReportType;
  detailRows: string[][];
  summaryRows: SummaryRow[];
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const isSummary =
    opts.reportType === "tfg_signed_summary" || opts.reportType === "tfg_cancellations_summary";

  if (!isSummary) {
    const ws = wb.addWorksheet("Szczegóły");
    ws.addRow([...DETAIL_HEADERS]);
    for (const row of opts.detailRows) {
      ws.addRow(row);
    }
  } else {
    const ws2 = wb.addWorksheet("Podsumowanie");
    ws2.addRow([...SUMMARY_HEADERS]);
    for (const r of opts.summaryRows) {
      ws2.addRow([r.category, r.agreementCount, r.participantSum, formatMoneyPln(r.valueSumPln)]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export function buildPdfBuffer(opts: {
  reportTitle: string;
  detailRows: string[][];
  summaryRows: SummaryRow[];
  isSummaryOnly: boolean;
}): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let pdfFont: "NotoSans" | "helvetica" = "helvetica";
  try {
    registerNotoFonts(doc);
    pdfFont = NOTO_SANS_FAMILY;
  } catch (e) {
    console.warn("[tfg-report PDF] Brak Noto Sans (pnpm run download-fonts):", e);
  }
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(11);
  doc.text(opts.reportTitle, 14, 12);

  let startY = 18;
  const docExt = doc as jsPDF & { lastAutoTable?: { finalY: number } };

  if (!opts.isSummaryOnly) {
    if (opts.detailRows.length > 0) {
      autoTable(doc, {
        startY,
        head: [[...DETAIL_HEADERS]],
        body: opts.detailRows,
        styles: {
          font: pdfFont,
          fontStyle: "normal",
          fontSize: 6,
          cellPadding: 0.5,
        },
        headStyles: {
          font: pdfFont,
          fontStyle: "bold",
          fillColor: [66, 66, 66],
        },
        margin: { left: 10, right: 10 },
      });
      startY = (docExt.lastAutoTable?.finalY ?? startY) + 8;
    } else {
      doc.setFont(pdfFont, "normal");
      doc.setFontSize(10);
      doc.text("Brak danych w wybranym okresie.", 14, startY);
    }
  }

  if (opts.isSummaryOnly) {
    if (opts.summaryRows.length > 0) {
      autoTable(doc, {
        startY,
        head: [[...SUMMARY_HEADERS]],
        body: opts.summaryRows.map((r) => [
          r.category,
          String(r.agreementCount),
          String(r.participantSum),
          formatMoneyPln(r.valueSumPln),
        ]),
        styles: {
          font: pdfFont,
          fontStyle: "normal",
          fontSize: 8,
          cellPadding: 1,
        },
        headStyles: {
          font: pdfFont,
          fontStyle: "bold",
          fillColor: [66, 66, 66],
        },
        margin: { left: 10, right: 10 },
      });
    } else {
      doc.setFont(pdfFont, "normal");
      doc.setFontSize(10);
      doc.text("Brak danych w wybranym okresie.", 14, startY);
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

export function reportFilename(
  reportType: TfgReportType,
  format: TfgReportFormat,
  periodLabel: string,
): string {
  const slug =
    reportType === "tfg_signed_detail"
      ? "tfg-zawarte-szczegol"
      : reportType === "tfg_signed_summary"
        ? "tfg-zawarte-podsumowanie"
        : reportType === "tfg_cancellations_detail"
          ? "tfg-rezygnacje-szczegol"
          : "tfg-rezygnacje-podsumowanie";
  return `raport-${slug}-${periodLabel}.${format}`;
}
