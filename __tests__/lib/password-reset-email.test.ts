import { describe, it, expect } from "@jest/globals";
import {
  generatePasswordResetEmail,
  PASSWORD_RESET_EMAIL_SUBJECT,
} from "@/lib/email/templates/password-reset";

describe("password reset email", () => {
  it("ma poprawny tytuł", () => {
    expect(PASSWORD_RESET_EMAIL_SUBJECT).toBe(
      "Reset hasła — Magia Podróżowania",
    );
  });

  it("zawiera link resetu i branding", () => {
    const link =
      "https://app.magia-podrozowania.pl/auth/callback?code=abc&next=/auth/update-password";
    const html = generatePasswordResetEmail(link);

    expect(html).toContain(link);
    expect(html).toContain("Magia Podróżowania");
    expect(html).toContain("Ustaw nowe hasło");
  });
});
