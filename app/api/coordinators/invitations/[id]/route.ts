import { NextRequest, NextResponse } from "next/server";
import { cancelInvitation } from "@/lib/actions/invitations";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const result = await cancelInvitation(id);

    if (!result.success) {
      if (result.error === "Nie jesteś zalogowany" || result.error === "Brak uprawnień") {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
      return NextResponse.json({ error: "cancel_failed", details: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/coordinators/invitations/[id]:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

