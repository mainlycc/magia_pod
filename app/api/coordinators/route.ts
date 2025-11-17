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

    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get("trip_id");

    // Pobierz wszystkich koordynatorów
    let query = supabase
      .from("profiles")
      .select("id, role, allowed_trip_ids")
      .eq("role", "coordinator");

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
    }

    // Jeśli podano trip_id, filtruj tylko tych przypisanych do tej wycieczki
    let filteredProfiles = profiles || [];
    if (tripId) {
      filteredProfiles = filteredProfiles.filter(
        (p) => p.allowed_trip_ids && Array.isArray(p.allowed_trip_ids) && p.allowed_trip_ids.includes(tripId)
      );
    }

    // Pobierz emaile z auth.users używając admin client
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers();

    const coordinators = filteredProfiles.map((profile) => {
      const user = usersData.users.find((u) => u.id === profile.id);
      return {
        id: profile.id,
        email: user?.email || null,
        allowed_trip_ids: profile.allowed_trip_ids,
      };
    });

    return NextResponse.json(coordinators);
  } catch {
    return NextResponse.json({ error: "unexpected" }, { status: 500 });
  }
}

