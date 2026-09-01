import { EMAIL_BRAND } from "../constants";
import {
  type PaymentReminderEmailParams,
  formatEmailDateLong,
} from "../payment-reminder-data";

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

function buildLocationSuffix(location: string | null): string {
  const trimmed = (location ?? "").trim();
  return trimmed ? ` (${trimmed})` : "";
}

function formatTripDateRange(startDate: string | null, endDate: string | null): string {
  const start = formatEmailDateLong(startDate);
  if (!endDate || endDate === startDate) return start;
  return `${start} – ${formatEmailDateLong(endDate)}`;
}

export function generatePaymentReminderEmail(params: PaymentReminderEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);
  const dateRange = formatTripDateRange(params.tripStartDate, params.tripEndDate);

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Przypomnienie o płatności - Magia Podróżowania</title>
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
                Przypomnienie o zbliżającym się terminie płatności
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${escapeHtml(greeting)} Przypominamy, że zbliża się termin uregulowania płatności za nadchodzący wyjazd.
              </p>

              <div style="background-color: ${EMAIL_BRAND.lightBg}; border-left: 4px solid ${EMAIL_BRAND.primary}; padding: 20px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: ${EMAIL_BRAND.text}; font-weight: 600;">
                  Link do szybkiej płatności online:
                </p>
                <p style="margin: 0; font-size: 14px; line-height: 1.6; word-break: break-all;">
                  <a href="${params.paymentLink}" style="color: ${EMAIL_BRAND.primary}; font-weight: 600;">${escapeHtml(params.paymentLink)}</a>
                </p>
                <div style="text-align: center; margin: 20px 0 0 0;">
                  <a href="${params.paymentLink}" style="display: inline-block; background: ${EMAIL_BRAND.gradient}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px ${EMAIL_BRAND.shadow};">
                    Zapłać teraz
                  </a>
                </div>
              </div>

              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827; font-weight: 600;">
                  Szczegóły rezerwacji
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
                  <li>Numer umowy: <strong>${escapeHtml(params.agreementNumber)}</strong></li>
                  <li>Wycieczka: <strong>${escapeHtml(params.tripTitle)}</strong>${escapeHtml(buildLocationSuffix(params.tripLocation))}</li>
                  <li>Termin wyjazdu: ${escapeHtml(dateRange)}</li>
                  <li>Cena całkowita: <strong>${escapeHtml(params.tripTotalPricePln)}</strong></li>
                  <li>Dotychczas opłacono: <strong>${escapeHtml(params.amountPaidPln)}</strong></li>
                  <li>Pozostało do zapłaty: <strong style="color: ${EMAIL_BRAND.primary};">${escapeHtml(params.amountRemainingPln)}</strong></li>
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
                To jest automatyczna wiadomość. Numer umowy: <strong>${escapeHtml(params.agreementNumber)}</strong>
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

export function generatePaymentReminderEmailText(params: PaymentReminderEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);
  const dateRange = formatTripDateRange(params.tripStartDate, params.tripEndDate);

  let text = `${greeting}\n\n`;
  text += `Przypominamy, że zbliża się termin uregulowania płatności za nadchodzący wyjazd.\n\n`;
  text += `Link do szybkiej płatności online:\n${params.paymentLink}\n\n`;
  text += `Szczegóły rezerwacji\n`;
  text += `• Numer umowy: ${params.agreementNumber}\n`;
  text += `• Wycieczka: ${params.tripTitle}${buildLocationSuffix(params.tripLocation)}\n`;
  text += `• Termin wyjazdu: ${dateRange}\n`;
  text += `• Cena całkowita: ${params.tripTotalPricePln}\n`;
  text += `• Dotychczas opłacono: ${params.amountPaidPln}\n`;
  text += `• Pozostało do zapłaty: ${params.amountRemainingPln}\n\n`;
  text += `Magia Podróżowania`;
  return text;
}
