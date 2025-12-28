export function generatePaymentReminderEmail(
  bookingRef: string,
  paymentLink: string,
  tripTitle: string,
  tripStartDate: string | null,
  amountCents: number,
  participantsCount: number
): string {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const amountPLN = (amountCents / 100).toFixed(2);

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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                Magia Podróżowania
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #2563eb; font-size: 24px; font-weight: 600;">
                Przypomnienie o płatności
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Witaj!
              </p>
              
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Przypominamy o konieczności dokonania płatności reszty kwoty za rezerwację <strong>${bookingRef}</strong>.
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Wycieczka:</td>
                    <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">${tripTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Data wyjazdu:</td>
                    <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">${formatDate(tripStartDate)}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Liczba uczestników:</td>
                    <td style="padding: 8px 0; text-align: right; color: #111827; font-size: 14px; font-weight: 600;">${participantsCount}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Kwota do zapłacenia:</td>
                    <td style="padding: 8px 0; text-align: right; color: #2563eb; font-size: 18px; font-weight: 700;">${amountPLN} PLN</td>
                  </tr>
                </table>
              </div>
              
              <p style="margin: 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Prosimy o dokonanie płatności poprzez kliknięcie w poniższy link:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  Zapłać teraz
                </a>
              </div>
              
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Jeśli masz jakiekolwiek pytania, prosimy o kontakt z naszym biurem.
              </p>
              
              <p style="margin: 30px 0 0 0; color: #374151; font-size: 16px; line-height: 1.6;">
                Pozdrawiamy,<br>
                <strong>Zespół Magii Podróżowania</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                To jest automatyczna wiadomość. Prosimy nie odpowiadać na ten e-mail.
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

