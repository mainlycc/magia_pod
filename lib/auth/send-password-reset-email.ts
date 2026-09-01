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

const UPDATE_PASSWORD_PATH = "/auth/update-password";

/**
 * Link do /auth/confirm z hashed_token — weryfikacja po stronie serwera (verifyOtp).
 * Nie używamy action_link z generateLink: po weryfikacji Supabase zwraca tokeny w #hash,
 * a /auth/callback oczekuje ?code= (PKCE).
 */
export function buildPasswordResetConfirmLink(
  baseUrl: string,
  hashedToken: string,
): string {
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type: "recovery",
    next: UPDATE_PASSWORD_PATH,
  });
  return `${baseUrl}/auth/confirm?${params.toString()}`;
}

/**
 * Generuje link recovery przez Supabase Admin API i wysyła własny mail przez Resend.
 * Nie używa resetPasswordForEmail — Supabase nie wysyła wtedy własnego maila.
 */
export async function sendPasswordResetEmail(
  email: string,
  requestOrigin?: string,
): Promise<SendPasswordResetResult> {
  const baseUrl = resolvePublicBaseUrl(requestOrigin);

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    // Nie ujawniamy, czy konto istnieje — logujemy błąd i zwracamy sukces.
    console.error("[password-reset] generateLink failed:", error.message);
    return { ok: true };
  }

  const hashedToken = data.properties?.hashed_token;
  if (!hashedToken) {
    console.error("[password-reset] generateLink returned no hashed_token");
    return { ok: true };
  }

  const resetLink = buildPasswordResetConfirmLink(baseUrl, hashedToken);

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
