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
    const from = process.env.RESEND_FROM;
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

    const { error } = await resend.emails.send({
      from,
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      attachments,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }
}


