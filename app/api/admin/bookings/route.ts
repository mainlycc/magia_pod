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
    console.log("[API Admin Bookings] Request received");
    const supabase = await createClient();

    // Sprawdź czy użytkownik jest adminem
    const isAdmin = await checkAdmin(supabase);
    console.log(`[API Admin Bookings] Admin check result: ${isAdmin}`);
    
    if (!isAdmin) {
      console.warn("[API Admin Bookings] Unauthorized access attempt");
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    // Użyj admin clienta do pobrania wszystkich rezerwacji (omija RLS)
    const adminClient = createAdminClient();
    
    const tripId = request.nextUrl.searchParams.get("trip_id");

    let query = adminClient
      .from("bookings")
      .select(
        `
        id,
        booking_ref,
        contact_email,
        contact_phone,
        payment_status,
        created_at,
        trip_id,
        trips:trips(id, title, slug)
      `,
      )
      .order("created_at", { ascending: false });

    if (tripId) {
      query = query.eq("trip_id", tripId);
    }

    const { data: bookingsData, error } = await query;

    if (error) {
      console.error("[API Admin Bookings] Error fetching bookings:", error);
      return NextResponse.json({ error: "fetch_failed", details: error.message }, { status: 500 });
    }

    console.log(`[API Admin Bookings] Fetched ${bookingsData?.length || 0} bookings`);

    if (!bookingsData || bookingsData.length === 0) {
      console.log("[API Admin Bookings] No bookings found in database");
      return NextResponse.json([]);
    }

    // Mapuj dane, aby przekształcić tablicę trips w pojedynczy obiekt
    const mappedBookings = bookingsData.map((booking: any) => ({
      ...booking,
      trips: Array.isArray(booking.trips) && booking.trips.length > 0 
        ? booking.trips[0] 
        : null,
    }));

    console.log(`[API Admin Bookings] Returning ${mappedBookings.length} mapped bookings`);
    return NextResponse.json(mappedBookings);
  } catch (error) {
    console.error("Unexpected error in GET /api/admin/bookings:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

