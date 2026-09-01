import { EMAIL_BRAND } from "../constants";
import type { PaymentConfirmedEmailParams } from "../payment-confirmation-data";

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

function buildInvoiceNoteHtml(params: PaymentConfirmedEmailParams): string {
  if (params.attachmentFilenames.length > 0) {
    return `
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                    W załączniku do tej wiadomości znajdziesz wygenerowaną fakturę.
                  </p>`;
  }
  if (params.invoiceViewUrl) {
    return `
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                    Fakturę możesz obejrzeć i pobrać online:
                    <a href="${params.invoiceViewUrl}" style="color: ${EMAIL_BRAND.primary}; font-weight: 600;">${escapeHtml(params.invoiceViewUrl)}</a>
                  </p>`;
  }
  return "";
}

function buildInvoiceNoteText(params: PaymentConfirmedEmailParams): string {
  if (params.attachmentFilenames.length > 0) {
    return "\n\nW załączniku do tej wiadomości znajdziesz wygenerowaną fakturę.";
  }
  if (params.invoiceViewUrl) {
    return `\n\nFakturę możesz obejrzeć online: ${params.invoiceViewUrl}`;
  }
  return "";
}

function buildAttachmentsText(filenames: string[]): string {
  if (filenames.length === 0) return "";
  return "\n\nZałączone dokumenty:\n" + filenames.map((name) => `• ${name}`).join("\n");
}

export function buildPaymentConfirmedEmailHtml(params: PaymentConfirmedEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Potwierdzenie płatności - Magia Podróżowania</title>
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
                    Potwierdzenie otrzymania płatności
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                    ${escapeHtml(greeting)} Dziękujemy za dokonaną wpłatę. Płatność za Twoją rezerwację w Magii Podróżowania została pomyślnie zaksięgowana w naszym systemie.
                  </p>
                  ${buildInvoiceNoteHtml(params)}
                  ${buildAttachmentsSection(params.attachmentFilenames)}
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
    </html>
  `.trim();
}

export function buildPaymentConfirmedEmailText(params: PaymentConfirmedEmailParams): string {
  const greeting = buildGreeting(params.contactFirstName);
  let text = `${greeting}\n\n`;
  text += `Dziękujemy za dokonaną wpłatę. Płatność za Twoją rezerwację w Magii Podróżowania została pomyślnie zaksięgowana w naszym systemie.`;
  text += buildInvoiceNoteText(params);
  text += buildAttachmentsText(params.attachmentFilenames);
  text += `\n\nMagia Podróżowania\nNumer umowy: ${params.agreementNumber}`;
  return text;
}
