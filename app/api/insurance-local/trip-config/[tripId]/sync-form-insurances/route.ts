import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { syncFormExtraInsurancesForTrip } from "@/lib/insurance-local/sync-form-extra-insurances"

// Wymuszenie synchronizacji form_extra_insurances z trip_insurance_variants.
// Używane do backfillu istniejących wycieczek przy wejściu na zakładkę
// "Ubezpieczenia" — żeby publiczny formularz rezerwacji pokazywał te warianty
// nawet jeśli nikt jeszcze nie kliknął "Dodaj/Edytuj/Usuń" po wprowadzeniu
// synchronizacji.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

    const { tripId } = await params
    const result = await syncFormExtraInsurancesForTrip(tripId)
    if (result === null) {
      return NextResponse.json({ error: "sync_failed" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, count: result.length })
  } catch (err) {
    console.error("POST /api/insurance-local/trip-config/[tripId]/sync-form-insurances error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
