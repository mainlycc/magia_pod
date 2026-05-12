import { test, expect } from "@playwright/test";
import {
  buildMockTripRow,
  installTripMocks,
  MOCK_TRIP_SLUG,
  type TripMockOverrides,
} from "./helpers/trip-mock-route";

const RESERVE_PATH = `/trip/${MOCK_TRIP_SLUG}/reserve`;

async function openBookingForm(page: import("@playwright/test").Page) {
  await page.goto(RESERVE_PATH);
  await expect(page.getByRole("heading", { name: /Rezerwacja wycieczki/i })).toBeVisible();
  /* CardTitle to <div>; exact: true — inne akapity mogą zawierać fragment „zgłaszającej” */
  await expect(
    page.getByText("Dane Osoby Zgłaszającej", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
}

/** Karta pojedynczego uczestnika (pola opcjonalne scopowane — unikamy etykiet z kroku Kontakt) */
function participantBlock(page: import("@playwright/test").Page, index: number) {
  return page
    .locator("div.rounded-xl.border.p-4.shadow-sm")
    .filter({ hasText: new RegExp(`Uczestnik\\s+${index}`) });
}

/** Tabs wywołują walidację kroku Kontakt — bez poprawnych danych nie da się przejść na Uczestników */
async function fillMinimalValidContact(page: import("@playwright/test").Page) {
  await page.getByLabel(/^Imię$/i).fill("Jan");
  await page.getByLabel(/^Nazwisko$/i).fill("Kowalski");
  const email = page.getByLabel(/^E-mail$/i);
  if ((await email.count()) > 0) await email.fill("jan.kowalski@test.example");
  const phone = page.getByLabel(/^Telefon$/i);
  if ((await phone.count()) > 0) await phone.fill("+48600111222");
  const pesel = page.getByLabel(/^PESEL$/i);
  if ((await pesel.count()) > 0) await pesel.fill("90010112345");
  const street = page.getByLabel(/^Ulica i numer$/i);
  if ((await street.count()) > 0) {
    await street.fill("ul. Testowa 1");
    await page.getByLabel(/^Miasto$/i).fill("Warszawa");
    await page.getByLabel(/^Kod pocztowy$/i).fill("00-001");
  }
}

function invoiceSection(page: import("@playwright/test").Page) {
  // <h3>Faktura</h3> w kroku Kontakt
  return page.getByRole("heading", { name: /^Faktura$/i }).locator("..");
}

function invoiceOtherDataToggle(page: import("@playwright/test").Page) {
  // Checkbox nie ma powiązanego label -> bierzemy go z kontenera tekstu.
  return page
    .getByText("Proszę o wystawienie faktury na inne dane", { exact: true })
    .locator("..") // div z tekstem label/description
    .locator("..") // FormItem
    .getByRole("checkbox");
}

function invoiceDetailsBox(page: import("@playwright/test").Page) {
  return invoiceSection(page).locator("div.rounded-md.border.p-3");
}

test.describe("Macierz konfiguracji formularza zgłoszeń (mock Supabase)", () => {
  test("adres zgłaszającego: włączony → pola adresu; wyłączony → brak pól", async ({
    page,
  }) => {
    const withAddress = buildMockTripRow({
      registration_mode: "individual",
      require_pesel: false,
      form_required_contact_fields: {
        pesel: false,
        email: true,
        phone: true,
        address: true,
      },
    });
    await installTripMocks(page, withAddress);
    await openBookingForm(page);
    /* W booking-form inline nie ma <h3>Adres — wystarczy pole ulicy */
    await expect(page.getByLabel(/^Ulica i numer$/i)).toBeVisible();

    const withoutAddress = buildMockTripRow({
      registration_mode: "individual",
      form_required_contact_fields: {
        pesel: false,
        email: true,
        phone: true,
        address: false,
      },
    });
    await installTripMocks(page, withoutAddress);
    await page.goto(RESERVE_PATH);
    await expect(page.getByText("Dane Osoby Zgłaszającej", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByLabel(/^Ulica i numer$/i)).toHaveCount(0);
  });

  test("PESEL kontaktu: tylko przy require_pesel lub fladze w JSON", async ({ page }) => {
    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        require_pesel: false,
        form_required_contact_fields: { pesel: false, email: true, phone: true, address: false },
      }),
    );
    await openBookingForm(page);
    await expect(page.getByLabel(/^PESEL$/i)).toHaveCount(0);

    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        require_pesel: false,
        form_required_contact_fields: { pesel: true, email: true, phone: true, address: false },
      }),
    );
    await page.goto(RESERVE_PATH);
    await expect(page.getByText("Dane Osoby Zgłaszającej", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByLabel(/^PESEL$/i)).toBeVisible();
  });

  test("email / telefon kontaktu: można ukryć przez form_required_contact_fields", async ({
    page,
  }) => {
    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        form_required_contact_fields: {
          pesel: false,
          email: false,
          phone: false,
          address: false,
        },
      }),
    );
    await openBookingForm(page);
    await expect(page.getByLabel(/^E-mail$/i)).toHaveCount(0);
    await expect(page.getByLabel(/^Telefon$/i)).toHaveCount(0);
  });

  test("krok Usługi dodatkowe: widoczny tylko gdy form_show_additional_services", async ({
    page,
  }) => {
    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        form_show_additional_services: false,
      }),
    );
    await openBookingForm(page);
    await expect(page.getByRole("tab", { name: /Usługi dodatkowe/i })).toHaveCount(0);

    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        form_show_additional_services: true,
      }),
    );
    await page.goto(RESERVE_PATH);
    await expect(page.getByText("Dane Osoby Zgłaszającej", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("tab", { name: /Usługi dodatkowe/i })).toBeVisible();
  });

  test("uczestnik: bez płeć / telefon / dokument gdy form_required_participant_fields puste", async ({
    page,
  }) => {
    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "individual",
        form_required_participant_fields: null,
      }),
    );
    await openBookingForm(page);
    await fillMinimalValidContact(page);
    /* Forward idzie „Dalej” — klik w tab jest blokowany przez canGoToStep przy pierwszym kroku */
    await page.getByRole("button", { name: /^Dalej$/i }).click();
    const b = participantBlock(page, 1);
    await expect(b.getByText("Płeć", { exact: true })).toHaveCount(0);
    await expect(b.getByLabel(/^Telefon$/i)).toHaveCount(0);
    await expect(b.getByLabel(/^Dokument$/i)).toHaveCount(0);
  });

  test("uczestnik: płeć, telefon, dokument gdy włączone w form_required_participant_fields", async ({
    page,
  }) => {
    const allOn: TripMockOverrides["form_required_participant_fields"] = {
      gender: true,
      phone: true,
      document: true,
    };
    await installTripMocks(page, buildMockTripRow({ form_required_participant_fields: allOn }));
    await openBookingForm(page);
    await fillMinimalValidContact(page);
    await page.getByRole("button", { name: /^Dalej$/i }).click();
    const b = participantBlock(page, 1);
    await expect(b.getByText("Płeć", { exact: true })).toBeVisible();
    await expect(b.getByLabel(/^Telefon$/i)).toBeVisible();
    await expect(b.getByLabel(/^Dokument$/i)).toBeVisible();
  });

  test("registration_mode both: przełączenie na firmę ukrywa PESEL osoby (jak w UI)", async ({
    page,
  }) => {
    await installTripMocks(
      page,
      buildMockTripRow({
        registration_mode: "both",
        require_pesel: false,
        form_required_contact_fields: {
          pesel: true,
          email: true,
          phone: true,
          address: false,
        },
      }),
    );
    await openBookingForm(page);
    await expect(page.getByLabel(/^PESEL$/i)).toBeVisible();
    await page.getByRole("button", { name: /Firma/i }).click();
    await expect(page.getByLabel(/^PESEL$/i)).toHaveCount(0);
    await expect(page.getByLabel(/Nazwa firmy/i)).toBeVisible();
  });

  test("faktura: domyślnie nie pokazuje pól innych danych", async ({ page }) => {
    await installTripMocks(page, buildMockTripRow({ registration_mode: "individual" }));
    await openBookingForm(page);

    await expect(invoiceSection(page)).toBeVisible();
    await expect(invoiceOtherDataToggle(page)).toBeVisible();
    await expect(invoiceDetailsBox(page)).toHaveCount(0);
    await expect(page.getByText("Typ danych do faktury", { exact: true })).toHaveCount(0);
  });

  test("faktura: po włączeniu „inne dane” pokazuje select typu i pola osoby/firma", async ({
    page,
  }) => {
    await installTripMocks(page, buildMockTripRow({ registration_mode: "individual" }));
    await openBookingForm(page);

    await invoiceOtherDataToggle(page).click();
    const box = invoiceDetailsBox(page);
    await expect(box).toBeVisible();
    await expect(box.getByText("Typ danych do faktury", { exact: true })).toBeVisible();

    // Wybierz "Firma" i sprawdź pola firmowe
    await box.getByRole("combobox").click();
    await page.getByRole("option", { name: /^Firma$/i }).click();
    await expect(box.getByPlaceholder("Nazwa Sp. z o.o.")).toBeVisible();
    await expect(box.getByPlaceholder(/1234567890/i)).toBeVisible();
    await expect(box.getByPlaceholder("ul. Słoneczna 12/5")).toBeVisible();
    await expect(box.getByPlaceholder("Warszawa")).toBeVisible();
    await expect(box.getByPlaceholder("00-001")).toBeVisible();

    // Przełącz na "Osoba fizyczna" i sprawdź pola osoby
    await box.getByRole("combobox").click();
    await page.getByRole("option", { name: /^Osoba fizyczna$/i }).click();
    await expect(box.getByPlaceholder("Jan")).toBeVisible();
    await expect(box.getByPlaceholder("Kowalski")).toBeVisible();
    await expect(box.getByPlaceholder("ul. Słoneczna 12/5")).toBeVisible();
    await expect(box.getByPlaceholder("Warszawa")).toBeVisible();
    await expect(box.getByPlaceholder("00-001")).toBeVisible();
  });
});
