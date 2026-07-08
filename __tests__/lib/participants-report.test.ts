// jest.setup.js globalnie mockuje jspdf — tutaj potrzebujemy prawdziwej implementacji,
// żeby zweryfikować faktyczne generowanie PDF.
jest.unmock("jspdf");

import {
  PARTICIPANT_REPORT_TYPES,
  buildParticipantsReportPdf,
  buildReportTable,
  participantsReportFilename,
  type ParticipantReportType,
} from "@/lib/reports/participants-report";

type TripData = Parameters<typeof buildReportTable>[2];
type ParticipantData = Parameters<typeof buildReportTable>[1][number];

const trip: TripData = {
  id: "trip-1",
  title: "Magiczna Norwegia",
  reservation_number: "123456",
  form_diets: [
    {
      id: "diet-1",
      title: "Wegetariańska",
      variants: [{ id: "var-1", title: "Bez laktozy" }],
    },
    { id: "diet-2", title: "Bezglutenowa" },
  ],
  form_additional_attractions: [
    { id: "att-1", title: "Rejs po fiordach" },
    { id: "att-2", title: "Kolejka górska Flåm" },
  ],
  form_extra_insurances: [{ id: "ins-1", title: "Ubezpieczenie KR" }],
};

const participants: ParticipantData[] = [
  {
    id: "p-1",
    first_name: "Anna",
    last_name: "Kowalska",
    pesel: "90010112345",
    email: "anna@example.com",
    phone: "+48 600 000 001",
    birth_date: "1990-01-01",
    document_type: "PASSPORT",
    document_number: "AB 1234567",
    document_expiry_date: "2030-05-15",
    gender_code: "F",
    selected_services: {
      diets: [{ service_id: "diet-1", variant_id: "var-1" }],
      attractions: [{ service_id: "att-1" }, { service_id: "att-2" }],
      insurances: [{ service_id: "ins-1" }],
    },
    bookings: {
      id: "b-1",
      booking_ref: "BR-001",
      payment_status: "paid",
      paid_amount_cents: 250000,
      contact_email: "kontakt@example.com",
      contact_phone: "+48 600 000 000",
      agreements: [
        {
          agreement_seq: 2,
          status: "signed",
          signed_at: "2026-06-01T10:00:00Z",
          generated_at: "2026-05-30T10:00:00Z",
        },
        {
          agreement_seq: 1,
          status: "generated",
          signed_at: null,
          generated_at: "2026-05-01T10:00:00Z",
        },
      ],
    },
  },
  {
    id: "p-2",
    first_name: "Jan",
    last_name: "Nowak",
    pesel: null,
    email: null,
    phone: null,
    birth_date: "1985-12-24",
    document_type: "ID",
    document_number: null,
    document_expiry_date: null,
    gender_code: "M",
    selected_services: null,
    bookings: {
      id: "b-2",
      booking_ref: "BR-002",
      payment_status: "partial",
      paid_amount_cents: 50000,
      contact_email: "jan@example.com",
      contact_phone: null,
      agreements: [],
    },
  },
];

describe("buildReportTable", () => {
  it("lista uczestników: imię i nazwisko, data urodzenia, płeć", () => {
    const table = buildReportTable("participants_list", participants, trip);
    expect(table.headers).toEqual(["Lp.", "Imię i nazwisko", "Data urodzenia", "Płeć"]);
    expect(table.rows).toEqual([
      ["1", "Anna Kowalska", "01.01.1990", "Kobieta"],
      ["2", "Jan Nowak", "24.12.1985", "Mężczyzna"],
    ]);
  });

  it("raport diet: tytuł diety z wariantem z katalogu wycieczki", () => {
    const table = buildReportTable("diets", participants, trip);
    expect(table.rows[0][3]).toBe("Wegetariańska (Bez laktozy)");
    expect(table.rows[1][3]).toBe("—");
  });

  it("raport atrakcji: dynamiczne kolumny wg maksymalnej liczby wybranych usług", () => {
    const table = buildReportTable("attractions", participants, trip);
    expect(table.headers).toEqual([
      "Lp.",
      "Imię i nazwisko",
      "Data urodzenia",
      "Wybrana usługa 1",
      "Wybrana usługa 2",
    ]);
    expect(table.rows[0].slice(3)).toEqual(["Rejs po fiordach", "Kolejka górska Flåm"]);
    expect(table.rows[1].slice(3)).toEqual(["—", "—"]);
  });

  it("lista z dokumentami: typ, seria i numer, data ważności", () => {
    const table = buildReportTable("documents", participants, trip);
    expect(table.rows[0]).toEqual([
      "1",
      "Anna Kowalska",
      "01.01.1990",
      "Paszport",
      "AB 1234567",
      "15.05.2030",
    ]);
    expect(table.rows[1].slice(3)).toEqual(["Dowód osobisty", "—", "—"]);
  });

  it("lista globalna: dane osobowe, usługi i dane umowy", () => {
    const table = buildReportTable("global", participants, trip);
    expect(table.orientation).toBe("landscape");

    const anna = table.rows[0];
    const headerIndex = (name: string) => table.headers.indexOf(name);
    expect(anna[headerIndex("PESEL")]).toBe("90010112345");
    expect(anna[headerIndex("Diety")]).toBe("Wegetariańska (Bez laktozy)");
    expect(anna[headerIndex("Atrakcje")]).toBe("Rejs po fiordach, Kolejka górska Flåm");
    expect(anna[headerIndex("Ubezpieczenia")]).toBe("Ubezpieczenie KR");
    // Najświeższa umowa (seq 2, podpisana) + numer wycieczki
    expect(anna[headerIndex("Numer umowy")]).toBe("123456/002");
    expect(anna[headerIndex("Status umowy")]).toBe("Podpisana");
    expect(anna[headerIndex("Data podpisania")]).toBe("01.06.2026");
    expect(anna[headerIndex("Status płatności")]).toBe("Opłacona");
    expect(anna[headerIndex("Wpłacono (PLN)")]).toBe((2500).toLocaleString("pl-PL", { minimumFractionDigits: 2 }));

    const jan = table.rows[1];
    expect(jan[headerIndex("Numer umowy")]).toBe("—");
    expect(jan[headerIndex("E-mail")]).toBe("jan@example.com");
    expect(jan[headerIndex("Status płatności")]).toBe("Częściowa");
  });
});

describe("buildParticipantsReportPdf", () => {
  it.each(PARTICIPANT_REPORT_TYPES.map((t) => [t] as [ParticipantReportType]))(
    "generuje poprawny bufor PDF dla raportu %s",
    (reportType) => {
      const table = buildReportTable(reportType, participants, trip);
      const buffer = buildParticipantsReportPdf({
        reportType,
        table,
        tripTitle: trip.title ?? "Wycieczka",
      });
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    },
  );

  it("generuje PDF z komunikatem przy braku uczestników", () => {
    const table = buildReportTable("participants_list", [], trip);
    const buffer = buildParticipantsReportPdf({
      reportType: "participants_list",
      table,
      tripTitle: "Pusta wycieczka",
    });
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});

describe("participantsReportFilename", () => {
  it("buduje slug z tytułu wycieczki i typu raportu", () => {
    expect(participantsReportFilename("diets", "Magiczna Łotwa – Zośka 2026")).toBe(
      "raport-diety-magiczna-lotwa-zoska-2026.pdf",
    );
    expect(participantsReportFilename("global", "")).toBe("raport-lista-globalna-wycieczka.pdf");
  });
});
