import { expect, type APIRequestContext, type Page } from "@playwright/test";

export type BookingTestData = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  pesel: string;
  street: string;
  city: string;
  zip: string;
  participant: {
    firstName: string;
    lastName: string;
    birthDate: string;
  };
};

export function generateBookingTestData(prefix = "e2e.prod"): BookingTestData {
  const ts = Date.now();
  return {
    email: `${prefix}.${ts}@e2e.magia.test`,
    firstName: "Jan",
    lastName: "Kowalski",
    phone: "500600700",
    pesel: "90010112345",
    street: "ul. Testowa 1",
    city: "Warszawa",
    zip: "00-001",
    participant: {
      firstName: "Jan",
      lastName: "Kowalski",
      birthDate: "15/05/1990",
    },
  };
}

type TripRow = {
  slug: string;
  title: string;
  is_active?: boolean;
  seats_total?: number | null;
  seats_reserved?: number | null;
  form_show_additional_services?: boolean | null;
};

async function isTripBookable(request: APIRequestContext, slug: string): Promise<boolean> {
  const res = await request.get(`/trip/${slug}/reserve`);
  if (!res.ok()) return false;
  const html = await res.text();
  if (/rezerwacja niedostępna|nie jest dostępna/i.test(html)) return false;
  return /kontakt/i.test(html);
}

async function pickBookableSlugFromTripPage(
  request: APIRequestContext,
  options?: { titlePattern?: RegExp; preferMinimal?: boolean },
): Promise<string> {
  const res = await request.get("/api/trips");
  if (res.ok()) {
    const trips = (await res.json()) as TripRow[];
    if (trips.length > 0) {
      const candidate = pickTripSlug(trips, options);
      if (await isTripBookable(request, candidate)) return candidate;
    }
  }

  const htmlRes = await request.get("/trip");
  expect(htmlRes.ok(), `GET /trip → ${htmlRes.status()}`).toBeTruthy();
  const html = await htmlRes.text();
  const slugs = [
    ...html.matchAll(/href="\/trip\/([a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]{3,})"/gi),
  ]
    .map((m) => m[1])
    .filter((s) => s !== "reserve" && !s.includes("/"));

  expect(slugs.length, "Nie znaleziono linków do wycieczek na /trip").toBeGreaterThan(0);
  const preferred = slugs.filter((s) => /[a-z-]/i.test(s));
  const ordered = [...preferred, ...slugs.filter((s) => !preferred.includes(s))];

  for (const slug of ordered) {
    if (await isTripBookable(request, slug)) {
      console.log(`[PROD] Slugi z /trip: ${slugs.slice(0, 5).join(", ")}… → wybrano: ${slug}`);
      return slug;
    }
  }

  throw new Error("Żadna wycieczka z /trip nie ma aktywnego formularza rezerwacji");
}

/** Slug wycieczki: env (jeśli dostępna) → strona /trip → API (jeśli dostępne). */
export async function resolveProductionTripSlug(
  request: APIRequestContext,
  options?: { titlePattern?: RegExp; preferMinimal?: boolean },
): Promise<string> {
  const fromEnv = process.env.PRODUCTION_TRIP_SLUG?.trim();
  if (fromEnv) {
    if (await isTripBookable(request, fromEnv)) return fromEnv;
    console.warn(
      `[PROD] PRODUCTION_TRIP_SLUG=${fromEnv} niedostępna — szukam innej wycieczki`,
    );
  }

  return pickBookableSlugFromTripPage(request, options);
}

function pickTripSlug(
  trips: TripRow[],
  options?: { titlePattern?: RegExp; preferMinimal?: boolean },
): string {
  const withSeats = trips.filter((t) => {
    if (t.is_active === false) return false;
    const total = t.seats_total ?? 0;
    const reserved = t.seats_reserved ?? 0;
    return total <= 0 || reserved < total;
  });

  const pool = withSeats.length > 0 ? withSeats : trips;

  if (options?.titlePattern) {
    const match = pool.find((t) => options.titlePattern!.test(t.title));
    if (match) return match.slug;
  }

  if (options?.preferMinimal) {
    const minimal = pool.find((t) => !t.form_show_additional_services);
    if (minimal) return minimal.slug;
  }

  return pool[0].slug;
}

export async function openReservePage(page: Page, slug: string) {
  await page.goto(`/trip/${slug}/reserve`, { waitUntil: "domcontentloaded" });
  await waitForBookingFormReady(page);
}

export async function waitForBookingFormReady(page: Page) {
  await expect(page.getByRole("tab", { name: /kontakt/i })).toBeVisible({
    timeout: 45_000,
  });
  await page
    .locator("form")
    .first()
    .waitFor({ state: "visible", timeout: 45_000 });
}

async function fillIfVisible(page: Page, label: RegExp, value: string) {
  const field = page.getByLabel(label).first();
  if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
    await field.fill(value);
  }
}

export async function fillContactStepIndividual(page: Page, data: BookingTestData) {
  const individualBtn = page.getByRole("button", { name: /^1\.\s*osoba fizyczna$/i });
  if (await individualBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await individualBtn.click();
  }

  await fillIfVisible(page, /^imię$/i, data.firstName);
  await fillIfVisible(page, /^nazwisko$/i, data.lastName);
  await fillIfVisible(page, /e-mail/i, data.email);
  await fillIfVisible(page, /telefon/i, data.phone);
  await fillIfVisible(page, /pesel/i, data.pesel);
  await fillIfVisible(page, /ulica i numer$/i, data.street);
  await fillIfVisible(page, /^miasto$/i, data.city);
  await fillIfVisible(page, /kod pocztowy$/i, data.zip);
}

export async function fillParticipantStep(page: Page, data: BookingTestData) {
  const participantsTab = page.getByRole("tab", { name: /uczestnicy/i });
  if (await participantsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await participantsTab.click();
  }

  const panel = page.getByRole("tabpanel", { name: /uczestnicy/i });

  await panel.getByLabel(/^imię$/i).first().fill(data.participant.firstName);
  await panel.getByLabel(/^nazwisko$/i).first().fill(data.participant.lastName);

  const birthInput = panel.getByPlaceholder(/wybierz datę|DD\/MM\/RRRR/i).first();
  await expect(birthInput).toBeVisible({ timeout: 5000 });
  await birthInput.fill(data.participant.birthDate);
  await birthInput.press("Enter");
  await birthInput.blur();

  const genderCombo = panel.getByRole("combobox", { name: /płeć/i }).first();
  if (await genderCombo.isVisible({ timeout: 1500 }).catch(() => false)) {
    await genderCombo.click();
    const option = page.getByRole("option", { name: /mężczyzna|kobieta/i }).first();
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
    }
  }

  const participantPhone = panel.getByLabel(/telefon/i).first();
  if (await participantPhone.isVisible({ timeout: 1500 }).catch(() => false)) {
    await participantPhone.fill(data.phone);
  }

  const docType = panel.getByLabel(/^dokument$/i).first();
  if (await docType.isVisible({ timeout: 2000 }).catch(() => false)) {
    await docType.click();
    await page.getByRole("option").first().click().catch(() => {});
    const serial = panel.getByLabel(/seria i numer dokumentu/i).first();
    if (await serial.isVisible({ timeout: 2000 }).catch(() => false)) {
      await serial.fill("ABC123456");
    }
  }
}

export async function advanceToSummaryStep(page: Page) {
  await clickDalej(page);
  await goThroughServicesStepIfVisible(page);

  await expect(page.getByRole("tab", { name: /zgody|podsumowanie/i })).toHaveAttribute(
    "data-state",
    "active",
    { timeout: 15_000 },
  );
}

export async function clickDalej(page: Page) {
  const btn = page.getByRole("button", { name: /^dalej$/i });
  await expect(btn).toBeEnabled({ timeout: 10_000 });
  await btn.click();
}

export async function goThroughServicesStepIfVisible(page: Page) {
  const servicesTab = page.getByRole("tab", { name: /usługi dodatkowe/i });
  if (!(await servicesTab.isVisible({ timeout: 2000 }).catch(() => false))) {
    return;
  }
  const isActive = await servicesTab.getAttribute("data-state");
  if (isActive === "active") {
    await clickDalej(page);
  }
}

export async function acceptAllConsents(page: Page) {
  const summaryTab = page.getByRole("tab", { name: /zgody|podsumowanie/i });
  await expect(summaryTab).toBeVisible({ timeout: 15_000 });

  const checkboxes = page.getByRole("checkbox");
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (await cb.isVisible().catch(() => false)) {
      const checked = await cb.isChecked().catch(() => true);
      if (!checked) await cb.check();
    }
  }
}

export async function submitBooking(
  page: Page,
  mode: "reserve" | "pay",
): Promise<void> {
  if (mode === "pay") {
    const payBtn = page.getByRole("button", { name: /rezerwuj i zapłać/i });
    await expect(payBtn).toBeVisible({ timeout: 10_000 });
    await payBtn.click();
  } else {
    const buttons = page.getByRole("button", { name: /rezerwuj/i });
    const count = await buttons.count();
    let clicked = false;
    for (let i = 0; i < count; i++) {
      const label = ((await buttons.nth(i).textContent()) ?? "").trim();
      if (/^rezerwuj$/i.test(label)) {
        await buttons.nth(i).click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      await expect(buttons.first()).toBeVisible({ timeout: 5000 });
      await buttons.first().click();
    }
  }
}

export type BookingConfirmation = {
  token: string;
  bookingRef: string | null;
  url: string;
};

export async function waitForBookingConfirmation(
  page: Page,
  options?: { allowPaynowRedirect?: boolean; timeout?: number },
): Promise<BookingConfirmation> {
  const timeout = options?.timeout ?? 90_000;

  if (options?.allowPaynowRedirect) {
    await page.waitForURL(
      /\/booking\/|paynow\.pl|sandbox\.paynow/i,
      { timeout },
    );
    if (/paynow/i.test(page.url())) {
      return {
        token: "",
        bookingRef: null,
        url: page.url(),
      };
    }
  } else {
    await page.waitForURL(/\/booking\/[^/]+/, { timeout });
  }

  const url = page.url();
  const tokenMatch = url.match(/\/booking\/([^/?]+)/);
  expect(tokenMatch?.[1], `Brak tokenu w URL: ${url}`).toBeTruthy();

  const bookingRef = await page
    .getByText(/BK-|kod rezerwacji|numer rezerwacji/i)
    .first()
    .textContent()
    .catch(() => null);

  return {
    token: tokenMatch![1],
    bookingRef: bookingRef?.match(/BK-[\w-]+/i)?.[0] ?? null,
    url,
  };
}

export async function assertBookingPageHealthy(page: Page) {
  await expect(page.getByText(/szczegóły rezerwacji|rezerwacja/i).first()).toBeVisible({
    timeout: 30_000,
  });

  const agreementEmpty = page.getByText(/numer umowy\s*[—–-]\s*$/i);
  const hasEmptyAgreement = await agreementEmpty.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasEmptyAgreement) {
    const refresh = page.getByRole("button", { name: /odśwież/i });
    if (await refresh.isVisible({ timeout: 2000 }).catch(() => false)) {
      await refresh.click();
      await page.waitForTimeout(3000);
    }
  }
}

export async function completeIndividualBookingWithoutPayment(
  page: Page,
  slug: string,
  data: BookingTestData,
): Promise<BookingConfirmation> {
  await openReservePage(page, slug);
  await fillContactStepIndividual(page, data);
  await clickDalej(page);
  await fillParticipantStep(page, data);
  await advanceToSummaryStep(page);
  await acceptAllConsents(page);

  const preview = page.locator("iframe, [class*='agreement']").first();
  await preview.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});

  await submitBooking(page, "reserve");
  const confirmation = await waitForBookingConfirmation(page);
  await assertBookingPageHealthy(page);
  return confirmation;
}
