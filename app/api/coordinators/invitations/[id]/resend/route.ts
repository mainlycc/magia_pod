import { NextRequest, NextResponse } from "next/server";
import { resendInvitations } from "@/lib/actions/invitations";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await resendInvitations([id]);

    if (!result.success) {
      if (result.error === "Nie jesteś zalogowany" || result.error === "Brak uprawnień") {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
      return NextResponse.json({ error: "resend_failed", details: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error in POST /api/coordinators/invitations/[id]/resend:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

