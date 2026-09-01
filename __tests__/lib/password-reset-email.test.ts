import { describe, it, expect } from "@jest/globals";
import { buildPasswordResetConfirmLink } from "@/lib/auth/send-password-reset-email";
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

  it("buduje link przez /auth/confirm z token_hash", () => {
    const link = buildPasswordResetConfirmLink(
      "https://app.magia-podrozowania.pl",
      "abc123hash",
    );

    expect(link).toBe(
      "https://app.magia-podrozowania.pl/auth/confirm?token_hash=abc123hash&type=recovery&next=%2Fauth%2Fupdate-password",
    );
  });

  it("zawiera link resetu i branding", () => {
    const link = buildPasswordResetConfirmLink(
      "https://app.magia-podrozowania.pl",
      "abc123hash",
    );
    const html = generatePasswordResetEmail(link);

    expect(html).toContain(link);
    expect(html).toContain("Magia Podróżowania");
    expect(html).toContain("Ustaw nowe hasło");
  });
});
