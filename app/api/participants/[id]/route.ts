import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function checkAdmin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  const { data: claims } = await supabase.auth.getClaims()
  const userId = (claims?.claims as { sub?: string } | null | undefined)?.sub
  if (!userId) return false

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  return profile?.role === "admin"
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const isAdmin = await checkAdmin(supabase)
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { data: participant, error: fetchError } = await adminClient
      .from("participants")
      .select("id, booking_id, bookings:bookings(id, trip_id)")
      .eq("id", id)
      .single()

    if (fetchError || !participant) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    const booking = Array.isArray(participant.bookings)
      ? participant.bookings[0]
      : participant.bookings
    const tripId =
      booking && typeof booking === "object" && "trip_id" in booking
        ? (booking.trip_id as string | null)
        : null

    if (tripId) {
      const { error: releaseError } = await supabase.rpc("release_trip_seats", {
        p_trip_id: tripId,
        p_requested: 1,
      })
      if (releaseError) {
        console.error("Failed to release seat after participant delete:", releaseError)
        // Kontynuuj usuwanie — miejsce można zsynchronizować później
      }
    }

    const { error: deleteError } = await adminClient
      .from("participants")
      .delete()
      .eq("id", id)

    if (deleteError) {
      console.error("Error deleting participant:", deleteError)
      return NextResponse.json({ error: "delete_failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error("Error in DELETE /api/participants/[id]:", err)
    return NextResponse.json({ error: "unexpected" }, { status: 500 })
  }
}
