import { Resend } from "resend";
import { generateInvitationEmail } from "./templates/invitation-email";

const FROM_EMAIL = process.env.RESEND_FROM || "noreply@mail.mainly.pl";

type SendInvitationEmailParams = {
  to: string;
  invitationLink: string;
  expiryDays?: number;
};

type SendEmailResult = {
  success: boolean;
  error?: string;
  messageId?: string;
};

export async function sendInvitationEmail({
  to,
  invitationLink,
  expiryDays = 7,
}: SendInvitationEmailParams): Promise<SendEmailResult> {
  try {
    // Twórz instancję Resend w funkcji, aby uniknąć problemów przy buildzie
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set in environment variables");
      return { success: false, error: "RESEND_API_KEY is not configured" };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const html = generateInvitationEmail("Koordynatorze", invitationLink, expiryDays);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Zaproszenie do systemu zarządzania wycieczkami - Aktywuj swoje konto",
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    console.log("Email sent successfully:", data);
    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nieoczekiwany błąd podczas wysyłania emaila",
    };
  }
}

