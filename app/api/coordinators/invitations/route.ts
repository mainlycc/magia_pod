import { NextRequest, NextResponse } from "next/server";
import { getInvitations, deleteInvitations } from "@/lib/actions/invitations";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const invitations = await getInvitations();

    if (invitations.length === 0) {
      // Może być brak uprawnień lub brak zaproszeń
      return NextResponse.json([]);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let filteredInvitations = invitations;
    if (status && ["pending", "accepted", "expired"].includes(status)) {
      filteredInvitations = invitations.filter((inv) => inv.status === status);
    }

    // Pobierz emaile adminów którzy wysłali zaproszenia
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers();

    const invitationsWithAdminEmail = filteredInvitations.map((invitation) => {
      const admin = usersData.users.find((u) => u.id === invitation.invited_by);
      return {
        id: invitation.id,
        email: invitation.email,
        status: invitation.status,
        token: invitation.token, // Dodajemy token dla generowania linku
        created_at: invitation.created_at,
        expires_at: invitation.expires_at,
        accepted_at: invitation.accepted_at,
        invited_by_email: admin?.email || null,
      };
    });

    return NextResponse.json(invitationsWithAdminEmail);
  } catch (error) {
    console.error("Unexpected error in GET /api/coordinators/invitations:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
    }

    const result = await deleteInvitations(ids);

    if (!result.success) {
      if (result.error === "Nie jesteś zalogowany" || result.error === "Brak uprawnień") {
        return NextResponse.json({ error: "unauthorized" }, { status: 403 });
      }
      return NextResponse.json({ error: "delete_failed", details: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/coordinators/invitations:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

