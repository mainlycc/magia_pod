import type { SupabaseClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NOTO_SANS_FAMILY, registerNotoFonts } from "@/lib/pdf/register-noto-fonts";
import { format } from "date-fns/format";
import { parseISO } from "date-fns/parseISO";
import { pl } from "date-fns/locale";
import { formatPublicAgreementNumber } from "@/lib/agreements/agreement-number-spec";
import { getPaymentStatusLabel } from "@/lib/payment-status";

export const PARTICIPANT_REPORT_TYPES = [
  "participants_list",
  "diets",
  "attractions",
  "documents",
  "global",
] as const;

export type ParticipantReportType = (typeof PARTICIPANT_REPORT_TYPES)[number];

export const PARTICIPANT_REPORT_TITLES: Record<ParticipantReportType, string> = {
  participants_list: "Lista uczestników",
  diets: "Raport diet",
  attractions: "Raport atrakcji",
  documents: "Lista uczestników z dokumentami",
  global: "Lista globalna",
};

type CatalogVariant = { id: string; title: string };

type CatalogItem = {
  id: string;
  title: string;
  variants?: CatalogVariant[];
};

type TripReportData = {
  id: string;
  title: string | null;
  reservation_number: string | null;
  form_diets: CatalogItem[];
  form_additional_attractions: CatalogItem[];
  form_extra_insurances: CatalogItem[];
};

type SelectedServiceEntry = {
  service_id?: string;
  variant_id?: string;
};

type AgreementLite = {
  agreement_seq: number | null;
  status: string | null;
  signed_at: string | null;
  generated_at: string | null;
};

type ParticipantRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  pesel: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  document_type: string | null;
  document_number: string | null;
  document_expiry_date: string | null;
  gender_code: string | null;
  selected_services: unknown;
  bookings: {
    id: string;
    booking_ref: string;
    payment_status: string | null;
    paid_amount_cents: number | null;
    contact_email: string | null;
    contact_phone: string | null;
    agreements: AgreementLite[] | null;
  } | null;
};

function parseCatalogArray(raw: unknown): CatalogItem[] {
  return Array.isArray(raw) ? (raw as CatalogItem[]) : [];
}

function formatPlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd.MM.yyyy", { locale: pl });
  } catch {
    return iso;
  }
}

function fullName(p: ParticipantRow): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "—";
}

function genderLabel(code: string | null): string {
  if (code === "F") return "Kobieta";
  if (code === "M") return "Mężczyzna";
  return "—";
}

function documentTypeLabel(type: string | null): string {
  if (type === "ID") return "Dowód osobisty";
  if (type === "PASSPORT") return "Paszport";
  return type || "—";
}

function agreementStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "generated":
      return "Wygenerowana";
    case "sent":
      return "Wysłana";
    case "signed":
      return "Podpisana";
    default:
      return status || "—";
  }
}

function formatMoneyPln(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseSelectedEntries(selectedServices: unknown, key: "diets" | "insurances" | "attractions"): SelectedServiceEntry[] {
  if (!selectedServices || typeof selectedServices !== "object") return [];
  const raw = (selectedServices as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is SelectedServiceEntry => !!e && typeof e === "object");
}

/** Mapuje wybraną pozycję (`service_id` + opcjonalny `variant_id`) na tytuł z katalogu wycieczki. */
function resolveServiceTitle(entry: SelectedServiceEntry, catalog: CatalogItem[]): string {
  const item = catalog.find((c) => c.id === entry.service_id);
  if (!item) return entry.service_id || "?";
  const variant = entry.variant_id
    ? item.variants?.find((v) => v.id === entry.variant_id)
    : undefined;
  return variant ? `${item.title} (${variant.title})` : item.title;
}

function resolveServiceTitles(
  selectedServices: unknown,
  key: "diets" | "insurances" | "attractions",
  catalog: CatalogItem[],
): string[] {
  return parseSelectedEntries(selectedServices, key).map((e) => resolveServiceTitle(e, catalog));
}

/** Najświeższa umowa rezerwacji — najwyższy agreement_seq, a przy braku sekwencji ostatnia wygenerowana. */
function latestAgreement(agreements: AgreementLite[] | null | undefined): AgreementLite | null {
  const list = Array.isArray(agreements) ? [...agreements] : [];
  if (list.length === 0) return null;
  list.sort((a, b) => {
    const seqDiff = (b.agreement_seq ?? 0) - (a.agreement_seq ?? 0);
    if (seqDiff !== 0) return seqDiff;
    return Date.parse(b.generated_at ?? "") - Date.parse(a.generated_at ?? "") || 0;
  });
  return list[0];
}

export async function fetchTripReportData(
  admin: SupabaseClient,
  tripId: string,
): Promise<TripReportData | null> {
  const { data, error } = await admin
    .from("trips")
    .select("id, title, reservation_number, form_diets, form_additional_attractions, form_extra_insurances")
    .eq("id", tripId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    title: data.title ?? null,
    reservation_number: data.reservation_number ?? null,
    form_diets: parseCatalogArray(data.form_diets),
    form_additional_attractions: parseCatalogArray(data.form_additional_attractions),
    form_extra_insurances: parseCatalogArray(data.form_extra_insurances),
  };
}

export async function fetchParticipantsForReport(
  admin: SupabaseClient,
  tripId: string,
): Promise<ParticipantRow[]> {
  const { data, error } = await admin
    .from("participants")
    .select(
      `
      id,
      first_name,
      last_name,
      pesel,
      email,
      phone,
      birth_date,
      document_type,
      document_number,
      document_expiry_date,
      gender_code,
      selected_services,
      bookings:bookings!inner (
        id,
        booking_ref,
        trip_id,
        payment_status,
        paid_amount_cents,
        contact_email,
        contact_phone,
        agreements:agreements (
          agreement_seq,
          status,
          signed_at,
          generated_at
        )
      )
    `,
    )
    .eq("bookings.trip_id", tripId);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as ParticipantRow[]).map((p) => ({
    ...p,
    bookings: Array.isArray(p.bookings) ? (p.bookings[0] ?? null) : p.bookings,
  }));

  rows.sort((a, b) => {
    const byLast = (a.last_name ?? "").localeCompare(b.last_name ?? "", "pl");
    if (byLast !== 0) return byLast;
    return (a.first_name ?? "").localeCompare(b.first_name ?? "", "pl");
  });

  return rows;
}

export type ParticipantReportTable = {
  headers: string[];
  rows: string[][];
  orientation: "portrait" | "landscape";
};

export function buildReportTable(
  reportType: ParticipantReportType,
  participants: ParticipantRow[],
  trip: TripReportData,
): ParticipantReportTable {
  switch (reportType) {
    case "participants_list":
      return {
        orientation: "portrait",
        headers: ["Lp.", "Imię i nazwisko", "Data urodzenia", "Płeć"],
        rows: participants.map((p, i) => [
          String(i + 1),
          fullName(p),
          formatPlDate(p.birth_date),
          genderLabel(p.gender_code),
        ]),
      };

    case "diets":
      return {
        orientation: "portrait",
        headers: ["Lp.", "Imię i nazwisko", "Data urodzenia", "Wybrana dieta"],
        rows: participants.map((p, i) => {
          const diets = resolveServiceTitles(p.selected_services, "diets", trip.form_diets);
          return [
            String(i + 1),
            fullName(p),
            formatPlDate(p.birth_date),
            diets.length > 0 ? diets.join(", ") : "—",
          ];
        }),
      };

    case "attractions": {
      const perParticipant = participants.map((p) =>
        resolveServiceTitles(p.selected_services, "attractions", trip.form_additional_attractions),
      );
      const maxServices = Math.max(1, ...perParticipant.map((list) => list.length));
      const serviceHeaders = Array.from({ length: maxServices }, (_, i) => `Wybrana usługa ${i + 1}`);
      return {
        orientation: maxServices > 3 ? "landscape" : "portrait",
        headers: ["Lp.", "Imię i nazwisko", "Data urodzenia", ...serviceHeaders],
        rows: participants.map((p, i) => {
          const services = perParticipant[i];
          return [
            String(i + 1),
            fullName(p),
            formatPlDate(p.birth_date),
            ...Array.from({ length: maxServices }, (_, k) => services[k] ?? "—"),
          ];
        }),
      };
    }

    case "documents":
      return {
        orientation: "portrait",
        headers: ["Lp.", "Imię i nazwisko", "Data urodzenia", "Typ dokumentu", "Seria i numer", "Data ważności"],
        rows: participants.map((p, i) => [
          String(i + 1),
          fullName(p),
          formatPlDate(p.birth_date),
          documentTypeLabel(p.document_type),
          p.document_number || "—",
          formatPlDate(p.document_expiry_date),
        ]),
      };

    case "global":
      return {
        orientation: "landscape",
        headers: [
          "Lp.",
          "Imię i nazwisko",
          "Data urodzenia",
          "Płeć",
          "PESEL",
          "E-mail",
          "Telefon",
          "Typ dokumentu",
          "Seria i numer",
          "Data ważności",
          "Diety",
          "Atrakcje",
          "Ubezpieczenia",
          "Numer umowy",
          "Status umowy",
          "Data podpisania",
          "Status płatności",
          "Wpłacono (PLN)",
        ],
        rows: participants.map((p, i) => {
          const booking = p.bookings;
          const agreement = latestAgreement(booking?.agreements);
          const diets = resolveServiceTitles(p.selected_services, "diets", trip.form_diets);
          const attractions = resolveServiceTitles(
            p.selected_services,
            "attractions",
            trip.form_additional_attractions,
          );
          const insurances = resolveServiceTitles(
            p.selected_services,
            "insurances",
            trip.form_extra_insurances,
          );
          return [
            String(i + 1),
            fullName(p),
            formatPlDate(p.birth_date),
            genderLabel(p.gender_code),
            p.pesel || "—",
            p.email || booking?.contact_email || "—",
            p.phone || booking?.contact_phone || "—",
            documentTypeLabel(p.document_type),
            p.document_number || "—",
            formatPlDate(p.document_expiry_date),
            diets.length > 0 ? diets.join(", ") : "—",
            attractions.length > 0 ? attractions.join(", ") : "—",
            insurances.length > 0 ? insurances.join(", ") : "—",
            agreement
              ? formatPublicAgreementNumber({
                  tripNumber: trip.reservation_number,
                  agreementSeq: agreement.agreement_seq,
                })
              : "—",
            agreement ? agreementStatusLabel(agreement.status) : "—",
            agreement?.signed_at ? formatPlDate(agreement.signed_at) : "—",
            getPaymentStatusLabel(booking?.payment_status),
            formatMoneyPln(booking?.paid_amount_cents),
          ];
        }),
      };
  }
}

export function buildParticipantsReportPdf(opts: {
  reportType: ParticipantReportType;
  table: ParticipantReportTable;
  tripTitle: string;
}): Buffer {
  const doc = new jsPDF({ orientation: opts.table.orientation, unit: "mm", format: "a4" });
  let pdfFont: "NotoSans" | "helvetica" = "helvetica";
  try {
    registerNotoFonts(doc);
    pdfFont = NOTO_SANS_FAMILY;
  } catch (e) {
    console.warn("[participants-report PDF] Brak Noto Sans (pnpm run download-fonts):", e);
  }

  const title = `${PARTICIPANT_REPORT_TITLES[opts.reportType]} — ${opts.tripTitle}`;
  const generatedAt = format(new Date(), "dd.MM.yyyy HH:mm", { locale: pl });

  doc.setFont(pdfFont, "bold");
  doc.setFontSize(12);
  doc.text(title, 14, 12);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(8);
  doc.text(`Wygenerowano: ${generatedAt} • Liczba uczestników: ${opts.table.rows.length}`, 14, 17);

  if (opts.table.rows.length > 0) {
    const isGlobal = opts.reportType === "global";
    autoTable(doc, {
      startY: 22,
      head: [opts.table.headers],
      body: opts.table.rows,
      styles: {
        font: pdfFont,
        fontStyle: "normal",
        fontSize: isGlobal ? 6 : 8,
        cellPadding: isGlobal ? 0.8 : 1.5,
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
    doc.text("Brak uczestników na tej wycieczce.", 14, 26);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function participantsReportFilename(
  reportType: ParticipantReportType,
  tripTitle: string,
): string {
  const typeSlug: Record<ParticipantReportType, string> = {
    participants_list: "lista-uczestnikow",
    diets: "diety",
    attractions: "atrakcje",
    documents: "dokumenty",
    global: "lista-globalna",
  };
  const tripSlug = slugify(tripTitle) || "wycieczka";
  return `raport-${typeSlug[reportType]}-${tripSlug}.pdf`;
}
