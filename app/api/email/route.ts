import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/send-transactional";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await sendTransactionalEmail(body);

    if (!result.ok) {
      const status =
        result.error.includes("Invalid payload") ? 400 : result.error.includes("not configured") ? 500 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }
}


