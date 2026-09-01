import { EMAIL_BRAND } from "../constants";
import type { AgreementUpdatedEmailParams } from "../agreement-updated-data";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildGreeting(firstName: string): string {
  return firstName ? `Dzień dobry ${firstName},` : "Dzień dobry,";
}

/**
 * Mail po aktualizacji umowy (np. zmiana usług dodatkowych u uczestnika).
 * Wymaga wcześniejszego przegenerowania PDF umowy.
 */
export function generateAgreementUpdatedEmailHtml(params: AgreementUpdatedEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaktualizowana umowa rezerwacji</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: ${EMAIL_BRAND.gradient}; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                Magia Podróżowania
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: ${EMAIL_BRAND.primary}; font-size: 24px; font-weight: 600;">
                Zaktualizowana umowa rezerwacji
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${escapeHtml(greeting)} Przesyłamy zaktualizowaną umowę. Dokument uwzględnia ostatnie zmiany wprowadzone w Twojej rezerwacji.
              </p>
              <div style="margin: 24px 0 0 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #111827; font-weight: 600;">
                  Załączone dokumenty:
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.7;">
                  <li style="margin: 4px 0;">📄 ${escapeHtml(params.attachmentFilename)}</li>
                </ul>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${EMAIL_BRAND.primary}; font-weight: 600;">
                Magia Podróżowania
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Numer umowy: <strong>${escapeHtml(params.agreementNumber)}</strong>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function generateAgreementUpdatedEmailText(params: AgreementUpdatedEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);
  let text = `${greeting}\n\n`;
  text += `Przesyłamy zaktualizowaną umowę. Dokument uwzględnia ostatnie zmiany wprowadzone w Twojej rezerwacji.\n\n`;
  text += `Załączone dokumenty:\n• ${params.attachmentFilename}\n\n`;
  text += `Magia Podróżowania\nNumer umowy: ${params.agreementNumber}`;
  return text;
}
