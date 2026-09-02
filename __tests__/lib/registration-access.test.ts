import { describe, it, expect } from "@jest/globals";
import {
  validateRegistrationToken,
  buildTripClientUrl,
  appendRegistrationTokenQuery,
} from "@/lib/trips/registration-access";

const TOKEN = "11111111-1111-4111-8111-111111111111";

describe("registration-access", () => {
  it("validateRegistrationToken akceptuje poprawny token", () => {
    expect(
      validateRegistrationToken({ registration_token: TOKEN }, TOKEN),
    ).toBe(true);
  });

  it("validateRegistrationToken odrzuca niepoprawny token", () => {
    expect(
      validateRegistrationToken({ registration_token: TOKEN }, "22222222-2222-4222-8222-222222222222"),
    ).toBe(false);
  });

  it("buildTripClientUrl zawiera token w query", () => {
    const url = buildTripClientUrl("050726", TOKEN, undefined, "https://app.test");
    expect(url).toBe("https://app.test/trip/050726?token=11111111-1111-4111-8111-111111111111");
  });

  it("buildTripClientUrl dla rezerwacji", () => {
    const url = buildTripClientUrl("050726", TOKEN, "reserve", "https://app.test");
    expect(url).toContain("/trip/050726/reserve?");
    expect(url).toContain(`token=${TOKEN}`);
  });

  it("appendRegistrationTokenQuery dopina token do ścieżki", () => {
    expect(appendRegistrationTokenQuery("/trip/x/reserve", TOKEN)).toBe(
      `/trip/x/reserve?token=${TOKEN}`,
    );
  });
});
