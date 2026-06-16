import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncParticipantInsurancesForTrip } from "@/lib/insurance-local/sync-participant-insurances"

// Backfill: synchronizuje participant_insurances z participants.selected_services
// dla wszystkich aktywnych rezerwacji na wycieczce.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId } = await params
    const result = await syncParticipantInsurancesForTrip(tripId)
    if (result === null) {
      return NextResponse.json({ error: "sync_failed" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("POST /api/insurance-local/trip-config/[tripId]/sync-participant-insurances error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
