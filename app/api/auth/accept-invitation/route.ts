import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Sprawdź czy email istnieje w coordinator_invitations ze statusem 'pending'
    const { data: invitation, error: invitationError } = await supabase
      .from("coordinator_invitations")
      .select("id, email, status, expires_at")
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (invitationError || !invitation) {
      // Jeśli nie ma zaproszenia, nie tworzymy profilu - użytkownik musi być zaproszony
      return NextResponse.json({ error: "invitation_not_found" }, { status: 404 });
    }

    // Sprawdź czy zaproszenie nie wygasło
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json({ error: "invitation_expired" }, { status: 400 });
    }

    // Sprawdź czy profil już istnieje
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .single();

    if (existingProfile) {
      // Jeśli profil już istnieje, sprawdź czy ma już role='coordinator'
      if (existingProfile.role === "coordinator") {
        // Aktualizuj status zaproszenia
        await supabase
          .from("coordinator_invitations")
          .update({
            status: "accepted",
            accepted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", invitation.id);
        return NextResponse.json({ ok: true, already_coordinator: true });
      }
      // Jeśli ma inną rolę, nie zmieniamy
      return NextResponse.json({ error: "profile_exists_with_different_role" }, { status: 400 });
    }

    // Utwórz profil z role='coordinator'
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      role: "coordinator",
      allowed_trip_ids: null,
    });

    if (profileError) {
      return NextResponse.json({ error: "profile_creation_failed" }, { status: 500 });
    }

    // Aktualizuj status zaproszenia na 'accepted'
    const { error: updateError } = await supabase
      .from("coordinator_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      // Loguj błąd, ale nie zwracaj błędu - profil został utworzony
      console.error("Failed to update invitation status:", updateError);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

