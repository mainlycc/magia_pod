export function buildPaymentConfirmedEmailHtml(params: {
  publicAgreementNumber: string;
  successUrl: string;
  hasAgreementAttachment: boolean;
}): string {
  const { publicAgreementNumber, successUrl, hasAgreementAttachment } = params;

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Płatność potwierdzona - Magia Podróżowania</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                    Magia Podróżowania
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; color: #16a34a; font-size: 24px; font-weight: 600;">
                    Płatność potwierdzona
                  </h2>
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                    Dziękujemy! Płatność za umowę <strong>${publicAgreementNumber}</strong> została zaksięgowana.
                  </p>
                  ${
                    hasAgreementAttachment
                      ? `
                  <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534; font-weight: 600;">
                      Dokumenty
                    </p>
                    <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">
                      W załączniku do tego maila znajdziesz umowę w formacie PDF.
                    </p>
                  </div>
                  `
                      : ""
                  }
                  <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                    Faktura zaliczkowa zostanie wysłana w osobnym mailu po jej wystawieniu.
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${successUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);">
                      Zobacz szczegóły rezerwacji
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function buildPaymentConfirmedEmailText(params: {
  publicAgreementNumber: string;
  successUrl: string;
  hasAgreementAttachment: boolean;
}): string {
  const { publicAgreementNumber, successUrl, hasAgreementAttachment } = params;
  const attachmentLine = hasAgreementAttachment
    ? "\n\nW załączniku do tego maila znajdziesz umowę w formacie PDF."
    : "";
  return `Dziękujemy! Płatność za umowę ${publicAgreementNumber} została zaksięgowana.${attachmentLine}\n\nFaktura zaliczkowa zostanie wysłana w osobnym mailu po jej wystawieniu.\n\nZobacz szczegóły rezerwacji: ${successUrl}`;
}
