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

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Pobierz wszystkich koordynatorów
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, role, allowed_trip_ids")
      .eq("role", "coordinator");

    if (profilesError) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    // Pobierz wszystkie wyjazdy dla mapowania
    const { data: trips, error: tripsError } = await supabase
      .from("trips")
      .select("id, title, start_date");

    if (tripsError) {
      console.error("Failed to load trips:", tripsError);
    }

    const tripsMap = new Map((trips || []).map((trip) => [trip.id, trip]));

    // Pobierz dane użytkowników z auth.users używając admin client
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers();

    const coordinators = (profiles || []).map((profile) => {
      const user = usersData.users.find((u) => u.id === profile.id);
      const fullName = user?.user_metadata?.full_name as string | undefined;
      const email = user?.email;
      
      // Pobierz informacje o przypisanych wyjazdach
      const tripIds = profile.allowed_trip_ids || [];
      const assignedTrips = tripIds
        .map((id: string) => tripsMap.get(id))
        .filter((trip) => trip !== undefined)
        .map((trip) => ({
          id: trip!.id,
          title: trip!.title,
          start_date: trip!.start_date,
        }));

      return {
        id: profile.id,
        full_name: fullName || null,
        email: email || null,
        allowed_trip_ids: profile.allowed_trip_ids || null,
        assigned_trips: assignedTrips,
      };
    });

    return NextResponse.json(coordinators);
  } catch (error) {
    console.error("Error fetching coordinators:", error);
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

