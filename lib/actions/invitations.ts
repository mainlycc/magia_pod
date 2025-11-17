"use server";

import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/send";
import { revalidatePath } from "next/cache";

export type CoordinatorInvitation = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  invited_by: string;
};

type CreateInvitationResult =
  | { success: true; invitation: CoordinatorInvitation }
  | { success: false; error: string };

type ValidateTokenResult =
  | { valid: true; email: string }
  | { valid: false; error: string };

type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function createInvitation(email: string): Promise<CreateInvitationResult> {
  const supabase = await createClient();

  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Nie jesteś zalogowany" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "Brak uprawnień" };
  }

  // Sprawdź czy użytkownik z tym emailem już istnieje w auth.users
  // Używamy admin client do sprawdzenia
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();
  const { data: usersData } = await adminClient.auth.admin.listUsers();
  const existingAuthUser = usersData.users.find((u) => u.email === email);

  if (existingAuthUser) {
    return { success: false, error: "Użytkownik z tym adresem email już istnieje" };
  }

  // Sprawdź czy istnieje aktywne zaproszenie dla tego emaila
  const { data: existingInvitation } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .eq("email", email)
    .eq("status", "pending")
    .single();

  if (existingInvitation) {
    const expiresAt = new Date(existingInvitation.expires_at);
    if (expiresAt > new Date()) {
      return { success: false, error: "Aktywne zaproszenie dla tego emaila już istnieje" };
    }
  }

  // Ustaw datę wygaśnięcia na 7 dni od teraz
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Utwórz zaproszenie (token jest generowany automatycznie przez bazę danych)
  const { data: invitation, error } = await supabase
    .from("coordinator_invitations")
    .insert({
      email,
      invited_by: user.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating invitation:", error);
    return { success: false, error: "Nie udało się utworzyć zaproszenia" };
  }

  // Wyślij email z zaproszeniem
  // PRIORYTET 1: NEXT_PUBLIC_APP_URL (jeśli ustawiony, zawsze używamy go)
  // PRIORYTET 2: VERCEL_URL tylko dla production
  // PRIORYTET 3: localhost w development
  let baseUrl = "http://localhost:3000";

  if (process.env.NEXT_PUBLIC_APP_URL) {
    // Zawsze używamy NEXT_PUBLIC_APP_URL jeśli jest ustawiony
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  } else if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_URL) {
    // Tylko jeśli NEXT_PUBLIC_APP_URL nie jest ustawiony, używamy VERCEL_URL
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }

  const invitationLink = `${baseUrl}/register?token=${invitation.token}`;

  const emailResult = await sendInvitationEmail({
    to: email,
    invitationLink,
    expiryDays: 7,
  });

  if (!emailResult.success) {
    console.error("Failed to send invitation email:", emailResult.error);
    // Kontynuujemy - zaproszenie jest już utworzone, użytkownik może skopiować link ręcznie
    // W przyszłości można dodać opcję ponownego wysłania emaila
  } else {
    console.log("Invitation email sent successfully to:", email);
  }

  revalidatePath("/admin/coordinators/invite");
  return { success: true, invitation: invitation as CoordinatorInvitation };
}

export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  const supabase = await createClient();

  console.log("Validating invitation token:", token);

  const { data: invitation, error } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (error) {
    console.error("Error fetching invitation:", error);
    return { valid: false, error: "Nieprawidłowy token zaproszenia" };
  }

  if (!invitation) {
    console.error("Invitation not found for token:", token);
    return { valid: false, error: "Nieprawidłowy token zaproszenia" };
  }

  console.log("Found invitation:", invitation);

  if (invitation.status !== "pending") {
    return { valid: false, error: "To zaproszenie zostało już wykorzystane lub wygasło" };
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);

  if (now > expiresAt) {
    // Aktualizuj status na expired
    await supabase
      .from("coordinator_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);

    return { valid: false, error: "To zaproszenie wygasło" };
  }

  return { valid: true, email: invitation.email };
}

export async function registerWithInvitation(
  token: string,
  fullName: string,
  password: string
): Promise<RegisterResult> {
  const supabase = await createClient();

  // Waliduj token
  const validation = await validateInvitationToken(token);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }
  if (!validation.email) {
    return { success: false, error: "Brak adresu email w zaproszeniu" };
  }

  // Pobierz zaproszenie
  const { data: invitation } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .eq("token", token)
    .single();

  if (!invitation) {
    return { success: false, error: "Nie znaleziono zaproszenia" };
  }

  // Utwórz użytkownika w Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: validation.email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: "coordinator",
      },
      emailRedirectTo: undefined, // Wyłączamy automatyczne potwierdzenie emaila
    },
  });

  if (authError) {
    console.error("Auth error:", authError);
    return { success: false, error: authError.message };
  }

  if (!authData.user) {
    return { success: false, error: "Nie udało się utworzyć konta" };
  }

  // Utwórz profil koordynatora
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    role: "coordinator",
    allowed_trip_ids: null,
  });

  if (profileError) {
    console.error("Error creating profile:", profileError);
    // Nie przerywamy - konto zostało utworzone, tylko profil się nie utworzył
  }

  // Aktualizuj status zaproszenia używając funkcji bazy danych (omija RLS)
  const { error: updateError } = await supabase.rpc("accept_invitation_by_token", {
    invitation_token: token,
  });

  if (updateError) {
    console.error("Error updating invitation:", updateError);
    // Nie przerywamy - konto zostało utworzone, tylko status zaproszenia się nie zaktualizował
  }

  // Odśwież cache dla strony zaproszeń (aby admin zobaczył zmieniony status)
  revalidatePath("/admin/coordinators/invite");

  return { success: true };
}

export async function getInvitations(): Promise<CoordinatorInvitation[]> {
  const supabase = await createClient();

  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return [];
  }

  const { data: invitations, error } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching invitations:", error);
    return [];
  }

  return (invitations || []) as CoordinatorInvitation[];
}

export async function resendInvitations(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Nie jesteś zalogowany" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "Brak uprawnień" };
  }

  // Pobierz zaproszenia
  const { data: invitations, error } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .in("id", ids);

  if (error || !invitations) {
    return { success: false, error: "Nie udało się pobrać zaproszeń" };
  }

  // Wyślij emaile ponownie
  let baseUrl = "http://localhost:3000";
  if (process.env.NEXT_PUBLIC_APP_URL) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  } else if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_URL) {
    baseUrl = `https://${process.env.VERCEL_URL}`;
  }

  for (const invitation of invitations) {
    const invitationLink = `${baseUrl}/register?token=${invitation.token}`;
    await sendInvitationEmail({
      to: invitation.email,
      invitationLink,
      expiryDays: 7,
    });
  }

  revalidatePath("/admin/coordinators/invite");
  return { success: true };
}

export async function deleteInvitations(ids: string[]): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Nie jesteś zalogowany" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "Brak uprawnień" };
  }

  const { error } = await supabase.from("coordinator_invitations").delete().in("id", ids);

  if (error) {
    return { success: false, error: "Nie udało się usunąć zaproszeń" };
  }

  revalidatePath("/admin/coordinators/invite");
  return { success: true };
}

export async function cancelInvitation(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Sprawdź czy użytkownik jest adminem
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Nie jesteś zalogowany" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { success: false, error: "Brak uprawnień" };
  }

  const { error } = await supabase
    .from("coordinator_invitations")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    return { success: false, error: "Nie udało się anulować zaproszenia" };
  }

  revalidatePath("/admin/coordinators/invite");
  return { success: true };
}

