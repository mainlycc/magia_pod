import { NextResponse } from "next/server";
import { Resend } from "resend";

type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachment?: { filename: string; base64: string } | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EmailPayload;
    if (!body?.to || !body?.subject) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    // Zawsze używamy domeny mail.mainly.pl (zweryfikowanej w Resend)
    // Jeśli RESEND_FROM jest ustawione, używamy lokalnej części (przed @), w przeciwnym razie "noreply"
    // Format wymagany przez Resend: "Name <email@mail.mainly.pl>"
    const envFrom = process.env.RESEND_FROM;
    const senderName = process.env.RESEND_FROM_NAME || "Magia Podróży";
    
    let emailAddress: string;
    if (envFrom && envFrom.includes("@")) {
      // Jeśli RESEND_FROM jest już w formacie "Name <email@domain.com>", wyciągnij tylko email
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
    if (!apiKey || !from) {
      return NextResponse.json({ error: "Email provider not configured" }, { status: 500 });
    }

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

    const html = body.html ?? (body.text ? `<pre>${body.text}</pre>` : "<div></div>");

    const { error } = await resend.emails.send({
      from,
      to: body.to,
      subject: body.subject,
      html,
      text: body.text ?? undefined,
      attachments,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }
}


