import { Resend } from "resend";
import { attachmentSizeFromBase64, logDevEmail } from "./dev-email-log";

export type TransactionalEmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachment?: { filename: string; base64: string } | null;
  /** Etykieta w logach dev (terminal) */
  logContext?: string;
};

function resolveResendFrom(): { from: string } | { error: string } {
  const apiKey = process.env.RESEND_API_KEY;
  const envFrom = process.env.RESEND_FROM;
  const senderName = process.env.RESEND_FROM_NAME || "Magia Podróży";

  let emailAddress: string;
  if (envFrom && envFrom.includes("@")) {
    const emailMatch = envFrom.match(/<([^>]+)>/) || envFrom.match(/([^\s<]+@[^\s>]+)/);
    if (emailMatch) {
      const existingEmail = emailMatch[1] || emailMatch[0];
      const localPart = existingEmail.split("@")[0];
      emailAddress = `${localPart}@mail.mainly.pl`;
    } else {
      const localPart = envFrom.split("@")[0];
      emailAddress = `${localPart}@mail.mainly.pl`;
    }
  } else {
    emailAddress = "noreply@mail.mainly.pl";
  }

  const from = `${senderName} <${emailAddress}>`;
  if (!apiKey) {
    return { error: "Email provider not configured (RESEND_API_KEY)" };
  }
  return { from };
}

/**
 * Wspólna wysyłka przez Resend — używana przez /api/email oraz serwis faktur (bez wewnętrznego HTTP).
 */
export async function sendTransactionalEmail(
  body: TransactionalEmailPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!body?.to || !body?.subject) {
    return { ok: false, error: "Invalid payload (to, subject)" };
  }

  const resolved = resolveResendFrom();
  if ("error" in resolved) {
    return { ok: false, error: resolved.error };
  }

  const apiKey = process.env.RESEND_API_KEY!;
  const resend = new Resend(apiKey);

  const attachments = body.attachment
    ? [
        {
          filename: body.attachment.filename,
          content: body.attachment.base64,
          encoding: "base64" as const,
        },
      ]
    : undefined;

  let html: string;
  if (body.html) {
    html = body.html;
  } else if (body.text) {
    html = `<div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">${body.text.replace(/\n/g, "<br>")}</div>`;
  } else {
    html = "<div></div>";
  }

  const logContext = body.logContext ?? "transactional-email";
  const devAttachments = body.attachment
    ? [
        {
          filename: body.attachment.filename,
          sizeBytes: attachmentSizeFromBase64(body.attachment.base64),
        },
      ]
    : [];

  const { error } = await resend.emails.send({
    from: resolved.from,
    to: body.to,
    subject: body.subject,
    html,
    text: body.text ?? undefined,
    attachments,
  });

  if (error) {
    logDevEmail({
      context: logContext,
      to: body.to,
      subject: body.subject,
      attachments: devAttachments,
      ok: false,
      error: error.message || "Resend send failed",
    });
    return { ok: false, error: error.message || "Resend send failed" };
  }

  logDevEmail({
    context: logContext,
    to: body.to,
    subject: body.subject,
    attachments: devAttachments,
    ok: true,
  });

  return { ok: true };
}
