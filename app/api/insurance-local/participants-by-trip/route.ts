import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET ?trip_id=
// Zwraca wszystkich aktywnych uczestników z rezerwacji dla danej wycieczki (dla ubezpieczenia Typ 1)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tripId = searchParams.get("trip_id")

    if (!tripId) {
      return NextResponse.json({ error: "trip_id jest wymagane" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("participants")
      .select(`
        id,
        first_name,
        last_name,
        date_of_birth,
        bookings!inner (
          id,
          booking_ref,
          trip_id,
          status
        )
      `)
      .eq("bookings.trip_id", tripId)
      .neq("bookings.status", "cancelled")
      .order("last_name", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const result = (data || []).map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      date_of_birth: p.date_of_birth,
      booking_ref: (p.bookings as unknown as { booking_ref: string }[] | { booking_ref: string })
        ? Array.isArray(p.bookings)
          ? (p.bookings as { booking_ref: string }[])[0]?.booking_ref || "—"
          : (p.bookings as unknown as { booking_ref: string }).booking_ref || "—"
        : "—",
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error("GET /api/insurance-local/participants-by-trip error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
