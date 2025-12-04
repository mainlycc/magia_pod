import { NextRequest, NextResponse } from "next/server";
import { createInvitation } from "@/lib/actions/invitations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }

    const result = await createInvitation(email);

    if (!result.success) {
      // Mapowanie błędów na kody odpowiedzi
      if (result.error === "Nie jesteś zalogowany" || result.error === "Brak uprawnień") {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
      if (result.error === "Użytkownik z tym adresem email już istnieje") {
        return NextResponse.json({ error: "user_already_exists" }, { status: 400 });
      }
      if (result.error === "Aktywne zaproszenie dla tego emaila już istnieje") {
        return NextResponse.json({ error: "invitation_already_exists" }, { status: 400 });
      }
      if (result.error === "Zaproszenie dla tego emaila już istnieje") {
        return NextResponse.json({ error: "invitation_already_exists" }, { status: 400 });
      }
      return NextResponse.json({ error: "create_failed", details: result.error }, { status: 500 });
    }

    return NextResponse.json({
      id: result.invitation.id,
      email: result.invitation.email,
      expires_at: result.invitation.expires_at,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/coordinators/invite:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

