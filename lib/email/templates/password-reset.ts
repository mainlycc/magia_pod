import { EMAIL_BRAND } from "../constants";

export function generatePasswordResetEmail(resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset hasła — Magia Podróżowania</title>
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
                Reset hasła
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta. Kliknij poniższy przycisk, aby ustawić nowe hasło:
              </p>
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${resetLink}"
                       style="display: inline-block; background: ${EMAIL_BRAND.gradient}; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px ${EMAIL_BRAND.shadow};">
                      Ustaw nowe hasło
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: ${EMAIL_BRAND.lightBg}; border-left: 4px solid ${EMAIL_BRAND.primary}; padding: 16px; border-radius: 6px; margin: 30px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: ${EMAIL_BRAND.text}; font-weight: 600;">
                  Ważne informacje
                </p>
                <p style="margin: 0; font-size: 14px; color: ${EMAIL_BRAND.text}; line-height: 1.5;">
                  Link wygaśnie po <strong>24 godzinach</strong>. Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość — Twoje hasło pozostanie bez zmian.
                </p>
              </div>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500;">
                  Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:
                </p>
                <p style="margin: 0; font-size: 12px; color: ${EMAIL_BRAND.primary}; word-break: break-all; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #d1d5db;">
                  ${resetLink}
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${EMAIL_BRAND.primary}; font-weight: 600;">
                Magia Podróżowania
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                Jeśli nie prosiłeś o reset hasła, możesz bezpiecznie zignorować tę wiadomość.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export const PASSWORD_RESET_EMAIL_SUBJECT =
  "Reset hasła — Magia Podróżowania";
