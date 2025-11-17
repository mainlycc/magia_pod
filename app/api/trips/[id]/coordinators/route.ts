import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper do sprawdzenia czy użytkownik to admin
async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims();
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub;
  if (!userId) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  return profile?.role === "admin";
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await context.params;
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz wszystkich koordynatorów przypisanych do tej wycieczki
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, allowed_trip_ids")
      .eq("role", "coordinator");

    if (error) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    // Filtruj tylko tych przypisanych do tej wycieczki
    const assignedCoordinators = (profiles || []).filter(
      (p) => p.allowed_trip_ids && Array.isArray(p.allowed_trip_ids) && p.allowed_trip_ids.includes(tripId)
    );

    // Pobierz emaile z auth.users używając admin client
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers();

    const coordinators = assignedCoordinators.map((profile) => {
      const user = usersData.users.find((u) => u.id === profile.id);
      return {
        id: profile.id,
        email: user?.email || null,
      };
    });

    return NextResponse.json(coordinators);
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: tripId } = await context.params;
    const body = await request.json();
    const { coordinator_id, action } = body as { coordinator_id: string; action: "assign" | "unassign" };

    if (!coordinator_id || !action || !["assign", "unassign"].includes(action)) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Sprawdź czy koordynator istnieje i ma odpowiednią rolę
    const { data: coordinator, error: coordinatorError } = await supabase
      .from("profiles")
      .select("id, role, allowed_trip_ids")
      .eq("id", coordinator_id)
      .eq("role", "coordinator")
      .single();

    if (coordinatorError || !coordinator) {
      return NextResponse.json({ error: "coordinator_not_found" }, { status: 404 });
    }

    let updatedTripIds: string[] = Array.isArray(coordinator.allowed_trip_ids) 
      ? [...coordinator.allowed_trip_ids] 
      : [];

    if (action === "assign") {
      // Dodaj trip_id jeśli nie istnieje
      if (!updatedTripIds.includes(tripId)) {
        updatedTripIds.push(tripId);
      }
    } else if (action === "unassign") {
      // Usuń trip_id z tablicy
      updatedTripIds = updatedTripIds.filter((id) => id !== tripId);
    }

    // Aktualizuj profil koordynatora
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ allowed_trip_ids: updatedTripIds.length > 0 ? updatedTripIds : null })
      .eq("id", coordinator_id);

    if (updateError) {
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

