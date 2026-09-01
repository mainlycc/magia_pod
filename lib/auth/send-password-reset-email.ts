import { createAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";
import {
  generatePasswordResetEmail,
  PASSWORD_RESET_EMAIL_SUBJECT,
} from "@/lib/email/templates/password-reset";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";

type SendPasswordResetResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Generuje link recovery przez Supabase Admin API i wysyła własny mail przez Resend.
 * Nie używa resetPasswordForEmail — Supabase nie wysyła wtedy własnego maila.
 */
export async function sendPasswordResetEmail(
  email: string,
  requestOrigin?: string,
): Promise<SendPasswordResetResult> {
  const baseUrl = resolvePublicBaseUrl(requestOrigin);
  const redirectTo = `${baseUrl}/auth/callback?next=/auth/update-password`;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error) {
    // Nie ujawniamy, czy konto istnieje — logujemy błąd i zwracamy sukces.
    console.error("[password-reset] generateLink failed:", error.message);
    return { ok: true };
  }

  const resetLink = data.properties?.action_link;
  if (!resetLink) {
    console.error("[password-reset] generateLink returned no action_link");
    return { ok: true };
  }

  const html = generatePasswordResetEmail(resetLink);
  const sendResult = await sendTransactionalEmail({
    to: email,
    subject: PASSWORD_RESET_EMAIL_SUBJECT,
    html,
    logContext: "password-reset",
  });

  if (!sendResult.ok) {
    console.error("[password-reset] Resend failed:", sendResult.error);
    return { ok: false, error: sendResult.error };
  }

  return { ok: true };
}
