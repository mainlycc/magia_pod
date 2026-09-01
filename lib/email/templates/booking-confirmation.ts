import { EMAIL_BRAND, EMAIL_PAYMENT_DETAILS } from "../constants";
import {
  type BookingConfirmationEmailParams,
  formatEmailDateLong,
} from "../booking-confirmation-data";

function buildGreeting(firstName: string): string {
  return firstName ? `Dzień dobry ${firstName},` : "Dzień dobry,";
}

function buildLocationSuffix(location: string | null): string {
  const trimmed = (location ?? "").trim();
  return trimmed ? ` (${trimmed})` : "";
}

function buildAttachmentsSection(filenames: string[]): string {
  if (filenames.length === 0) return "";
  const items = filenames
    .map((name) => `<li style="margin: 4px 0;">📄 ${escapeHtml(name)}</li>`)
    .join("");
  return `
              <div style="margin: 24px 0 0 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; color: #111827; font-weight: 600;">
                  Załączone dokumenty:
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.7;">
                  ${items}
                </ul>
              </div>`;
}

function buildAttachmentsText(filenames: string[]): string {
  if (filenames.length === 0) return "";
  return (
    "\n\nZałączone dokumenty:\n" +
    filenames.map((name) => `• ${name}`).join("\n")
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPaymentSectionHtml(params: BookingConfirmationEmailParams): string {
  if (!params.showPaymentInstructions) return "";

  const transferTitle = `Numer umowy: ${params.agreementNumber} + ${params.contactLastName || "—"}`;

  let onlinePayment = "";
  if (params.paymentLink) {
    onlinePayment = `
                <p style="margin: 16px 0 0 0; font-size: 14px; color: #374151; line-height: 1.6;">
                  Możesz też opłacić rezerwację online:
                  <a href="${params.paymentLink}" style="color: ${EMAIL_BRAND.primary}; font-weight: 600;">Zapłać teraz</a>
                </p>`;
  }

  return `
              <div style="background-color: ${EMAIL_BRAND.lightBg}; border-left: 4px solid ${EMAIL_BRAND.primary}; padding: 20px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0 0 12px 0; font-size: 16px; color: ${EMAIL_BRAND.text}; font-weight: 600;">
                  Płatność
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
                  <li>Jeżeli nie dokonałeś płatności, opłać do <strong>${escapeHtml(params.depositDeadline)}</strong></li>
                  <li>Numer konta: <strong>${EMAIL_PAYMENT_DETAILS.bankAccount}</strong></li>
                  <li>Odbiorca: <strong>${EMAIL_PAYMENT_DETAILS.recipient}</strong></li>
                  <li>Adres: ${EMAIL_PAYMENT_DETAILS.address}</li>
                  <li>Tytuł: <strong>${escapeHtml(transferTitle)}</strong></li>
                </ul>
                ${onlinePayment}
              </div>`;
}

function buildPaymentSectionText(params: BookingConfirmationEmailParams): string {
  if (!params.showPaymentInstructions) return "";

  const transferTitle = `Numer umowy: ${params.agreementNumber} + ${params.contactLastName || "—"}`;
  let text = `\n\nPłatność\n`;
  text += `• Jeżeli nie dokonałeś płatności, opłać do ${params.depositDeadline}\n`;
  text += `• Numer konta: ${EMAIL_PAYMENT_DETAILS.bankAccount}\n`;
  text += `• Odbiorca: ${EMAIL_PAYMENT_DETAILS.recipient}\n`;
  text += `• Adres: ${EMAIL_PAYMENT_DETAILS.address}\n`;
  text += `• Tytuł: ${transferTitle}`;
  if (params.paymentLink) {
    text += `\n• Płatność online: ${params.paymentLink}`;
  }
  return text;
}

export function generateBookingConfirmationEmail(params: BookingConfirmationEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);
  const startDate = formatEmailDateLong(params.tripStartDate);
  const endDate = formatEmailDateLong(params.tripEndDate);
  const dateRange =
    params.tripEndDate && params.tripStartDate !== params.tripEndDate
      ? `${startDate} – ${endDate}`
      : startDate;

  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Potwierdzenie rezerwacji - Magia Podróżowania</title>
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
                Potwierdzenie rezerwacji
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                ${escapeHtml(greeting)} Dziękujemy za rezerwację w Magii Podróżowania! Twoja rezerwacja została pomyślnie zarejestrowana w naszym systemie.
              </p>

              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827; font-weight: 600;">
                  Szczegóły rezerwacji
                </p>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #374151; line-height: 1.8;">
                  <li>Numer umowy: <strong>${escapeHtml(params.agreementNumber)}</strong></li>
                  <li>Wycieczka: <strong>${escapeHtml(params.tripTitle)}</strong>${escapeHtml(buildLocationSuffix(params.tripLocation))}</li>
                  <li>Termin: ${escapeHtml(dateRange)}</li>
                  <li>Liczba uczestników: <strong>${params.participantsCount}</strong></li>
                  <li>Cena całkowita: <strong>${escapeHtml(params.tripTotalPricePln)}</strong></li>
                </ul>
              </div>

              ${buildPaymentSectionHtml(params)}

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; font-weight: 600;">
                  Co dalej?
                </p>
                <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #92400e; line-height: 1.8;">
                  <li>Dokonaj płatności (jeśli jeszcze nie została opłacona) — płatność jest potwierdzeniem zawarcia umowy</li>
                  <li>Zachowaj numer umowy i ten e-mail na przyszłość</li>
                </ul>
              </div>

              ${buildAttachmentsSection(params.attachmentFilenames)}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: ${EMAIL_BRAND.primary}; font-weight: 600;">
                Magia Podróżowania
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                W razie pytań prosimy o kontakt. Twój numer umowy: <strong>${escapeHtml(params.agreementNumber)}</strong>
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

export function generateBookingConfirmationEmailText(
  params: BookingConfirmationEmailParams,
): string {
  const greeting = buildGreeting(params.contactFirstName);
  const startDate = formatEmailDateLong(params.tripStartDate);
  const endDate = formatEmailDateLong(params.tripEndDate);
  const dateRange =
    params.tripEndDate && params.tripStartDate !== params.tripEndDate
      ? `${startDate} – ${endDate}`
      : startDate;

  let text = `${greeting}\n\n`;
  text += `Dziękujemy za rezerwację w Magii Podróżowania! Twoja rezerwacja została pomyślnie zarejestrowana w naszym systemie.\n\n`;
  text += `Szczegóły rezerwacji\n`;
  text += `• Numer umowy: ${params.agreementNumber}\n`;
  text += `• Wycieczka: ${params.tripTitle}${buildLocationSuffix(params.tripLocation)}\n`;
  text += `• Termin: ${dateRange}\n`;
  text += `• Liczba uczestników: ${params.participantsCount}\n`;
  text += `• Cena całkowita: ${params.tripTotalPricePln}`;
  text += buildPaymentSectionText(params);
  text += `\n\nCo dalej?\n`;
  text += `• Dokonaj płatności (jeśli jeszcze nie została opłacona) — płatność jest potwierdzeniem zawarcia umowy\n`;
  text += `• Zachowaj numer umowy i ten e-mail na przyszłość`;
  text += buildAttachmentsText(params.attachmentFilenames);
  text += `\n\nMagia Podróżowania`;
  return text;
}