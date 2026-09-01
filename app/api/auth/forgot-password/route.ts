import { NextRequest, NextResponse } from "next/server";
import { sendPasswordResetEmail } from "@/lib/auth/send-password-reset-email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const result = await sendPasswordResetEmail(
      email,
      request.nextUrl.origin,
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: "email_send_failed" },
        { status: 500 },
      );
    }

    // Zawsze zwracamy sukces — nie ujawniamy, czy konto istnieje.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password] unexpected error:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}
