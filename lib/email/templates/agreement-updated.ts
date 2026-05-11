/**
 * Mail po aktualizacji umowy (np. zmiana usług dodatkowych u uczestnika).
 */
export function generateAgreementUpdatedEmailHtml(params: {
  bookingRef: string;
  tripTitle: string;
  bookingLink: string | null;
}): string {
  const { bookingRef, tripTitle, bookingLink } = params;
  const linkBlock = bookingLink
    ? `
              <div style="text-align: center; margin: 28px 0;">
                <a href="${bookingLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
                  Zobacz rezerwację
                </a>
              </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaktualizowana umowa</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 36px 28px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;">Magia Podróżowania</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 28px;">
              <h2 style="margin: 0 0 18px 0; color: #1e40af; font-size: 22px; font-weight: 600;">Zaktualizowana umowa</h2>
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                W załączniku przesyłamy <strong>aktualną wersję umowy</strong> do rezerwacji <strong>${bookingRef}</strong>
                (${tripTitle}).
              </p>
              <p style="margin: 0 0 16px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Dokument odzwierciedla m.in. zmiany w wybranych usługach dodatkowych. Prosimy o zapoznanie się z treścią załączonego pliku PDF.
              </p>
              ${linkBlock}
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                W razie pytań pozostajemy do dyspozycji.
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

export function generateAgreementUpdatedEmailText(params: {
  bookingRef: string;
  tripTitle: string;
  bookingLink: string | null;
}): string {
  const { bookingRef, tripTitle, bookingLink } = params;
  const lines = [
    "Zaktualizowana umowa — Magia Podróżowania",
    "",
    `W załączniku przesyłamy aktualną wersję umowy do rezerwacji ${bookingRef} (${tripTitle}).`,
    "Dokument odzwierciedla m.in. zmiany w wybranych usługach dodatkowych.",
    "",
  ];
  if (bookingLink) {
    lines.push(`Link do rezerwacji: ${bookingLink}`, "");
  }
  lines.push("W razie pytań pozostajemy do dyspozycji.");
  return lines.join("\n");
}
