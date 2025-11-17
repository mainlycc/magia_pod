export function generateInvitationEmail(
  name: string,
  invitationLink: string,
  expiryDays: number = 7
): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zaproszenie do Magia Podróżowania</title>
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
                Zaproszenie do systemu
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Witaj ${name}!
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #333333;">
                Zostałeś zaproszony do systemu zarządzania wycieczkami jako koordynator. Aby aktywować swoje konto, kliknij poniższy przycisk:
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${invitationLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); transition: all 0.3s ease;">
                      Aktywuj konto
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Info Box -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 6px; margin: 30px 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #166534; font-weight: 600;">
                  ⏰ Ważne informacje
                </p>
                <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">
                  Link aktywacyjny wygaśnie za <strong>${expiryDays} ${expiryDays === 1 ? 'dzień' : expiryDays < 5 ? 'dni' : 'dni'}</strong>. 
                  Po wygaśnięciu będziesz musiał poprosić o nowe zaproszenie.
                </p>
              </div>
              
              <!-- Alternative Link -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; font-weight: 500;">
                  Jeśli przycisk nie działa, skopiuj i wklej poniższy link do przeglądarki:
                </p>
                <p style="margin: 0; font-size: 12px; color: #22c55e; word-break: break-all; font-family: monospace; background-color: #ffffff; padding: 10px; border-radius: 4px; border: 1px solid #d1d5db;">
                  ${invitationLink}
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
                Jeśli nie spodziewałeś się tego zaproszenia, możesz bezpiecznie zignorować tę wiadomość.
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

