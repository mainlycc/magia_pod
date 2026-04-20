export function generateBookingConfirmationEmail(
  bookingRef: string,
  bookingLink: string,
  tripTitle: string,
  tripStartDate: string | null,
  tripEndDate: string | null,
  participantsCount: number,
  paymentLink?: string | null
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
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">
                Magia Podróżowania
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #16a34a; font-size: 24px; font-weight: 600;">
                Potwierdzenie rezerwacji
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Dziękujemy za rezerwację w Magii Podróżowania!
              </p>
              
              <!-- Booking Details -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <div style="margin-bottom: 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                    Kod rezerwacji
                  </p>
                  <p style="margin: 0; font-size: 24px; color: #16a34a; font-weight: 700; font-family: monospace; letter-spacing: 1px;">
                    ${bookingRef}
                  </p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
                  <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">
                    Wycieczka
                  </p>
                  <p style="margin: 0 0 4px 0; font-size: 18px; color: #111827; font-weight: 600;">
                    ${tripTitle}
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">
                    ${formatDate(tripStartDate)} ${tripEndDate ? `- ${formatDate(tripEndDate)}` : ""}
                  </p>
                </div>
                
                <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">
                    Liczba uczestników: <strong style="color: #111827;">${participantsCount}</strong>
                  </p>
                </div>
              </div>
              
              <!-- CTA Buttons -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${bookingLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); transition: all 0.3s ease;">
                      Szczegóły rezerwacji
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0 0; font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5;">
                Kliknij powyższy przycisk, aby przejść do szczegółów rezerwacji.
              </p>
              ${paymentLink ? `
              <!-- Payment Link -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #1e40af; font-weight: 600;">
                  💳 Płatność
                </p>
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #1e40af; line-height: 1.5;">
                  Możesz dokonać płatności za rezerwację klikając w poniższy link:
                </p>
                <table role="presentation" style="width: 100%; margin: 12px 0;">
                  <tr>
                    <td align="center" style="padding: 0;">
                      <a href="${paymentLink}" 
                         style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s ease;">
                        Zapłać teraz
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              ` : ''}
              
              <!-- Instructions -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #92400e; font-weight: 600;">
                  ⚠️ Co dalej?
                </p>
                <ol style="margin: 8px 0 0 0; padding-left: 20px; font-size: 14px; color: #92400e; line-height: 1.8;">
                  <li><strong>Dokonaj płatności</strong> (jeśli jeszcze nie została opłacona) — płatność jest potwierdzeniem zawarcia umowy</li>
                  <li><strong>Zachowaj kod rezerwacji</strong> i ten e-mail na przyszłość</li>
                  <li><strong>W razie pytań</strong> skontaktuj się z nami, podając kod rezerwacji</li>
                </ol>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500;">
                  Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:
                </p>
                <p style="margin: 0; font-size: 12px; color: #22c55e; word-break: break-all; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #d1d5db;">
                  ${bookingLink}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #16a34a; font-weight: 600;">
                Magia Podróżowania
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">
                W razie pytań prosimy o kontakt. Twój kod rezerwacji: <strong>${bookingRef}</strong>
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

