"use server";

import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email/send";
import { revalidatePath } from "next/cache";

/**
 * Zwraca base URL aplikacji dla linków zaproszeń
 * PRIORYTET 1: NEXT_PUBLIC_APP_URL (jeśli ustawiony, zawsze używamy go)
 * PRIORYTET 2: magia-pod.vercel.app dla produkcji na Vercel
 * PRIORYTET 3: VERCEL_URL tylko dla production
 * PRIORYTET 4: localhost w development
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  // Jeśli jesteśmy na Vercel w produkcji, używamy magia-pod.vercel.app
  if (process.env.VERCEL_ENV === "production") {
    return "https://magia-pod.vercel.app";
  }
  
  // Fallback na VERCEL_URL jeśli jest dostępny
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Development - localhost
  return "http://localhost:3000";
}

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

  // Sprawdź czy istnieje zaproszenie dla tego emaila (dowolny status)
  const { data: existingInvitation, error: checkError } = await supabase
    .from("coordinator_invitations")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking existing invitation:", checkError);
    return { success: false, error: "Błąd podczas sprawdzania istniejących zaproszeń" };
  }

  // Jeśli istnieje zaproszenie pending i nie wygasło, zwróć błąd
  if (existingInvitation && existingInvitation.status === "pending") {
    const expiresAt = new Date(existingInvitation.expires_at);
    if (expiresAt > new Date()) {
      return { success: false, error: "Aktywne zaproszenie dla tego emaila już istnieje" };
    }
    // Jeśli wygasło, usuniemy je i utworzymy nowe
    await supabase
      .from("coordinator_invitations")
      .delete()
      .eq("id", existingInvitation.id);
  } else if (existingInvitation) {
    // Jeśli istnieje accepted lub expired, usuń je aby móc utworzyć nowe
    await supabase
      .from("coordinator_invitations")
      .delete()
      .eq("id", existingInvitation.id);
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
    // Sprawdź czy to błąd duplikatu
    if (error.code === "23505") {
      return { success: false, error: "Zaproszenie dla tego emaila już istnieje" };
    }
    return { success: false, error: "Nie udało się utworzyć zaproszenia" };
  }

  // Wyślij email z zaproszeniem
  const baseUrl = getBaseUrl();
  const invitationLink = `${baseUrl}/register?token=${invitation.token}`;

  const emailResult = await sendInvitationEmail({
    to: email,
    invitationLink,
    expiryDays: 7,
  });

  if (!emailResult.success) {
    console.error("Failed to send invitation email:", emailResult.error);
    console.error("Invitation created but email not sent. Invitation ID:", invitation.id);
    console.error("Invitation link:", invitationLink);
    // Kontynuujemy - zaproszenie jest już utworzone, użytkownik może skopiować link ręcznie
    // W przyszłości można dodać opcję ponownego wysłania emaila
  } else {
    console.log("Invitation email sent successfully to:", email, "Message ID:", emailResult.messageId);
  }

  revalidatePath("/admin/coordinators/invite");
  return { success: true, invitation: invitation as CoordinatorInvitation };
}

export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  const supabase = await createClient();

  console.log("Validating invitation token:", token);

  // Użyj funkcji bazy danych, która omija RLS i pozwala na dostęp dla niezalogowanych użytkowników
  const { data: invitations, error } = await supabase.rpc("get_invitation_by_token", {
    invitation_token: token,
  });

  if (error) {
    console.error("Error fetching invitation:", error);
    return { valid: false, error: "Nieprawidłowy token zaproszenia" };
  }

  if (!invitations || invitations.length === 0) {
    console.error("Invitation not found for token:", token);
    return { valid: false, error: "Nieprawidłowy token zaproszenia" };
  }

  // Funkcja zwraca tablicę, więc bierzemy pierwszy element
  const invitation = invitations[0];

  console.log("Found invitation:", invitation);

  if (invitation.status !== "pending") {
    return { valid: false, error: "To zaproszenie zostało już wykorzystane lub wygasło" };
  }

  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);

  if (now > expiresAt) {
    // Aktualizuj status na expired używając admin clienta (omija RLS)
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    await adminClient
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

  // Pobierz zaproszenie używając funkcji RPC (omija RLS)
  const { data: invitations, error: invitationError } = await supabase.rpc(
    "get_invitation_by_token",
    {
      invitation_token: token,
    }
  );

  if (invitationError || !invitations || invitations.length === 0) {
    return { success: false, error: "Nie znaleziono zaproszenia" };
  }

  const invitation = invitations[0];

  // Utwórz użytkownika w Supabase Auth bez wysyłania maila potwierdzającego
  // Używamy admin clienta i ustawiamy email_confirm=true
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createAdminClient();

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: validation.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "coordinator",
    },
  });

  if (authError) {
    console.error("Auth error:", authError);
    return { success: false, error: authError.message };
  }

  if (!authData.user) {
    return { success: false, error: "Nie udało się utworzyć konta" };
  }

  // Utwórz profil koordynatora używając admin clienta (omija RLS)
  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authData.user.id,
    role: "coordinator",
    allowed_trip_ids: null,
  });

  if (profileError) {
    console.error("Error creating profile:", profileError);
    // Jeśli nie udało się utworzyć profilu, zwróć błąd - to jest krytyczne
    return { success: false, error: `Nie udało się utworzyć profilu: ${profileError.message}` };
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
  const baseUrl = getBaseUrl();

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

